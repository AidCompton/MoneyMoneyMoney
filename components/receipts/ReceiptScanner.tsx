"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { saveReceipt } from "@/lib/actions/receipts";
import { formatPrice } from "@/lib/currency";
import { todayISO } from "@/lib/dates";
import { nameKey } from "@/lib/lists";
import type { ReceiptDraft, ScanResult } from "@/lib/receipts/types";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsap";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { Crop } from "./Crop";

type Category = { id: string; name: string; color: string };
type Scope = "shared" | "personal";

type Row = {
  id: string;
  raw: string;
  name: string;
  quantity: string;
  lineTotal: string;
  sharedCategoryId: string;
  personalCategory: string;
  sharedSub: string;
  personalSub: string;
  issues: string[];
  confirmed: boolean;
  crop: ScanResult["items"][number]["crop"];
  remembered: boolean;
};

type Check = { id: string; label: string; target: string };

const cents = (value: string) => Math.round((Number(value.replace(",", ".")) || 0) * 100);
const money = (c: number) => (c < 0 ? "-" : "") + formatPrice(Math.abs(c) / 100);

/** Downscales a phone photo before upload (smaller, faster, and upright). */
async function shrink(file: File): Promise<Blob> {
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.9),
    );
  } catch {
    return file; // the server can read most formats itself
  }
}

/**
 * Scan a receipt, then review what was read. Anything unclear becomes a
 * question in "Things to check", and saving waits until each is answered.
 */
export function ReceiptScanner({
  defaultScope,
  userId,
  sharedCategories,
  personalCategories,
  subcategories,
  stores,
  groceryNames,
}: {
  defaultScope: Scope;
  userId: string;
  sharedCategories: Category[];
  personalCategories: Category[];
  subcategories: Record<Scope, Record<string, string[]>>;
  stores: string[];
  groceryNames: string[];
}) {
  const [phase, setPhase] = useState<"pick" | "reading" | "review" | "saved">("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [store, setStore] = useState("");
  const [storeConfirmed, setStoreConfirmed] = useState(false);
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ receiptId: string; expenseCount: number } | null>(null);
  const [saving, startSaving] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  // --- Reading ---------------------------------------------------------------

  async function read(file: File) {
    setError(null);
    setPreview(URL.createObjectURL(file));
    setPhase("reading");
    try {
      const body = new FormData();
      body.append("photo", await shrink(file), "receipt.jpg");
      const response = await fetch("/api/receipts/scan", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The receipt couldn't be read.");
      begin(result as ScanResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The receipt couldn't be read.");
      setPhase("pick");
    }
  }

  function begin(result: ScanResult) {
    setScan(result);
    setStore(result.store.value);
    setStoreConfirmed(result.store.sure);
    setDate(result.date.value);
    setTotal(result.total !== null ? result.total.toFixed(2) : "");
    setRows(
      result.items.map((item, i) => ({
        id: `r${i}`,
        raw: item.raw,
        name: item.name,
        quantity: String(item.quantity),
        lineTotal: item.lineTotal !== null ? item.lineTotal.toFixed(2) : "",
        sharedCategoryId: item.shared.categoryId ?? "",
        personalCategory: item.personal.category,
        sharedSub: item.shared.subcategory,
        personalSub: item.personal.subcategory,
        issues: item.issues,
        confirmed: item.issues.length === 0,
        crop: item.crop,
        remembered: item.remembered,
      })),
    );
    setPhase("review");
  }

  function startBlank() {
    begin({
      token: "",
      image: { src: "", width: 0, height: 0 },
      store: { value: "", sure: false, crop: null },
      date: { value: todayISO(), sure: true },
      total: null,
      items: [],
    });
  }

  // --- Review ---------------------------------------------------------------

  const update = (id: string, patch: Partial<Row>) =>
    setRows((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const itemsCents = rows.reduce((sum, r) => sum + cents(r.lineTotal), 0);
  const totalCents = cents(total);
  const difference = totalCents - itemsCents;
  const categoryOf = (r: Row) =>
    scope === "shared" ? sharedCategories.find((c) => c.id === r.sharedCategoryId)?.name ?? "" : r.personalCategory;

  const checks: Check[] = useMemo(() => {
    const list: Check[] = [];
    if (!store.trim()) list.push({ id: "store", label: "Which store was this?", target: "receipt-store" });
    else if (!storeConfirmed) list.push({ id: "store", label: `Is the store "${store}"?`, target: "receipt-store" });
    if (!date) list.push({ id: "date", label: "What date was this receipt?", target: "receipt-date" });
    if (!total || totalCents <= 0) list.push({ id: "total", label: "What did the receipt come to?", target: "receipt-total" });
    for (const r of rows) {
      const label = r.name || "this item";
      if (!r.confirmed) list.push({ id: `${r.id}-read`, label: `${label}: ${r.issues[0]}`, target: r.id });
      else if (!r.name.trim()) list.push({ id: `${r.id}-name`, label: "What was this item?", target: r.id });
      else if (!r.lineTotal) list.push({ id: `${r.id}-price`, label: `What did ${label} cost?`, target: r.id });
      else if (!categoryOf(r)) list.push({ id: `${r.id}-cat`, label: `Which category is ${label}?`, target: r.id });
    }
    if (rows.length === 0) list.push({ id: "items", label: "Add the items on the receipt.", target: "receipt-items" });
    else if (total && difference !== 0) {
      list.push({
        id: "balance",
        label: `The items come to ${money(itemsCents)}, but the total is ${money(totalCents)}.`,
        target: "receipt-balance",
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, storeConfirmed, date, total, rows, scope, difference]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      if (phase === "reading") {
        gsap.fromTo("[data-scanline]", { yPercent: -100 }, { yPercent: 900, duration: 1.6, ease: "sine.inOut", repeat: -1, yoyo: true });
      }
      if (phase === "review") {
        gsap.from("[data-row]", { autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.04, ease: "expo.out" });
      }
      if (phase === "saved") {
        gsap.from("[data-saved]", { scale: 0.6, autoAlpha: 0, duration: 0.8, ease: "back.out(2.5)" });
      }
    },
    { scope: root, dependencies: [phase] },
  );

  function jump(target: string) {
    const el = document.getElementById(target);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el && !prefersReducedMotion()) {
      gsap.fromTo(el, { boxShadow: "0 0 0 0 rgba(247,195,92,0.9)" }, { boxShadow: "0 0 0 12px rgba(247,195,92,0)", duration: 1.2, delay: 0.3 });
    }
  }

  function save() {
    setError(null);
    const draft: ReceiptDraft = {
      token: scan?.token || null,
      scope,
      store,
      date,
      total: totalCents / 100,
      items: rows.map((r) => ({
        raw: r.raw,
        name: r.name,
        quantity: Number(r.quantity) || 1,
        lineTotal: cents(r.lineTotal) / 100,
        category: scope === "shared" ? r.sharedCategoryId : r.personalCategory,
        subcategory: scope === "shared" ? r.sharedSub : r.personalSub,
      })),
    };
    startSaving(async () => {
      const result = await saveReceipt(draft);
      if (result.error || !result.receiptId) {
        setError(result.error ?? "It couldn't be saved. Please try again.");
        return;
      }
      setSaved({ receiptId: result.receiptId, expenseCount: result.expenseCount ?? 1 });
      setPhase("saved");
    });
  }

  function reset() {
    setPhase("pick");
    setScan(null);
    setRows([]);
    setSaved(null);
    setError(null);
    setPreview(null);
  }

  // --- Screens --------------------------------------------------------------

  if (phase === "pick") {
    return (
      <div ref={root} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={buttonClasses({ size: "lg", className: "w-full cursor-pointer" })}>
            <CameraIcon /> Take a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label="Take a photo of a receipt"
              onChange={(e) => e.target.files?.[0] && read(e.target.files[0])}
            />
          </label>
          <label className={buttonClasses({ size: "lg", variant: "secondary", className: "w-full cursor-pointer" })}>
            Choose a photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Choose a receipt photo"
              onChange={(e) => e.target.files?.[0] && read(e.target.files[0])}
            />
          </label>
        </div>
        <p className="text-sm text-ivory/50">
          Lay the receipt flat in good light and fill the frame. It&apos;s read on your own computer; the photo never
          leaves home.{" "}
          <button type="button" onClick={startBlank} className="font-semibold text-gold hover:underline">
            Or type it in
          </button>
          .
        </p>
        {error && (
          <p role="alert" className="rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (phase === "reading") {
    return (
      <div ref={root} className="flex flex-col items-center gap-5 py-4">
        <div className="relative w-full max-w-xs overflow-hidden rounded-2xl ring-1 ring-white/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="Your receipt" className="block w-full opacity-70" />}
          <span
            data-scanline
            aria-hidden
            className="absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-transparent via-mint/60 to-transparent shadow-[0_0_30px_rgb(79_227_165/0.6)]"
          />
        </div>
        <p role="status" className="text-sm font-semibold text-mint">
          Reading your receipt…
        </p>
      </div>
    );
  }

  if (phase === "saved" && saved) {
    return (
      <div ref={root} className="flex flex-col items-center gap-4 py-6 text-center">
        <span
          data-saved
          className="grid h-16 w-16 place-items-center rounded-full bg-mint text-night shadow-[0_0_40px_rgb(79_227_165/0.6)]"
        >
          <svg viewBox="0 0 16 16" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-xl font-semibold" role="status">
          Saved {money(totalCents)} at {store}
        </p>
        <p className="text-sm text-ivory/55">
          {rows.length} item{rows.length === 1 ? "" : "s"} as {saved.expenseCount} expense
          {saved.expenseCount === 1 ? "" : "s"} in the {scope === "shared" ? "shared" : "personal"} budget.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href={`/receipts/${saved.receiptId}`} className={buttonClasses({ variant: "secondary" })}>
            View receipt
          </Link>
          <Button type="button" onClick={reset}>
            Scan another
          </Button>
          <Link
            href={scope === "shared" ? "/budget" : `/personal/${userId}`}
            className={buttonClasses({ variant: "ghost" })}
          >
            Go to budget
          </Link>
        </div>
      </div>
    );
  }

  // Review
  const image = scan?.image;
  const categoryOptions = personalCategories.map((c) => ({ value: c.name, color: c.color }));

  return (
    <div ref={root} className="space-y-6">
      {/* Things to check */}
      <div
        className={`rounded-2xl border p-4 transition-colors duration-500 ${
          checks.length ? "border-gold/30 bg-gold/[0.06]" : "border-mint/30 bg-mint/[0.06]"
        }`}
        aria-live="polite"
      >
        {checks.length ? (
          <>
            <p className="text-sm font-semibold text-gold">
              {checks.length} thing{checks.length === 1 ? "" : "s"} to check
            </p>
            <ul className="mt-2 space-y-1">
              {checks.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => jump(c.target)}
                    className="text-left text-sm text-ivory/80 underline decoration-gold/40 underline-offset-4 hover:text-ivory"
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm font-semibold text-mint">✓ Everything checks out. Ready to save.</p>
        )}
      </div>

      {/* Receipt details */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/55">Budget</span>
          <div className="inline-flex rounded-full bg-white/[0.05] p-1 ring-1 ring-inset ring-white/10">
            {(["shared", "personal"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => setScope(s)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  scope === s ? (s === "shared" ? "bg-gold/15 text-gold" : "bg-mint/15 text-mint") : "text-ivory/60"
                }`}
              >
                {s === "shared" ? "Shared" : "Personal"}
              </button>
            ))}
          </div>
        </div>
        <div id="receipt-store" className="rounded-2xl sm:col-span-2">
          <Label htmlFor="receipt-store-input">Store</Label>
          {!storeConfirmed && image?.src && scan?.store.crop && (
            <Crop src={image.src} width={image.width} height={image.height} box={scan.store.crop} className="mb-2 max-w-sm" />
          )}
          <div className="flex gap-2">
            <Combobox
              id="receipt-store-input"
              name="store"
              options={stores}
              defaultValue={store}
              noun="store"
              className="flex-1"
              onValueChange={(v) => {
                setStore(v);
                setStoreConfirmed(true);
              }}
            />
            {!storeConfirmed && store && (
              <Button type="button" variant="secondary" size="sm" className="h-auto" onClick={() => setStoreConfirmed(true)}>
                Yes
              </Button>
            )}
          </div>
        </div>
        <div id="receipt-date" className="rounded-2xl">
          <Label htmlFor="receipt-date-input">Date</Label>
          <Input id="receipt-date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div id="receipt-total" className="rounded-2xl">
          <Label htmlFor="receipt-total-input">Receipt total (R)</Label>
          <Input
            id="receipt-total-input"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
      </div>

      {/* Items */}
      <div id="receipt-items" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/55">
            Items · {rows.length}
          </h3>
          {scope === "shared" && rows.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-ivory/55">
              Put everything in
              <Select
                aria-label="Category for every item"
                className="w-auto py-1.5 text-sm"
                value=""
                onChange={(e) => e.target.value && setRows((all) => all.map((r) => ({ ...r, sharedCategoryId: e.target.value })))}
              >
                <option value="">choose…</option>
                {sharedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>

        {rows.map((r) => {
          const catName = categoryOf(r);
          const subOptions = subcategories[scope][nameKey(catName)] ?? [];
          const flagged = !r.confirmed;
          return (
            <div
              key={r.id}
              id={r.id}
              data-row
              className={`rounded-2xl border p-3 transition-colors duration-500 sm:p-4 ${
                flagged ? "border-gold/40 bg-gold/[0.05]" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {flagged && (
                <div className="mb-3 space-y-2">
                  <p className="text-sm text-gold">{r.issues[0]}</p>
                  {image?.src && r.crop && (
                    <Crop src={image.src} width={image.width} height={image.height} box={r.crop} className="max-w-md" />
                  )}
                </div>
              )}
              <div className="grid grid-cols-[5rem_1fr_auto] items-end gap-2 sm:grid-cols-[1fr_4.5rem_6.5rem_auto]">
                <div className="col-span-3 min-w-0 sm:col-span-1">
                  <Label htmlFor={`${r.id}-name`}>Item</Label>
                  <Combobox
                    id={`${r.id}-name`}
                    name={`${r.id}-name`}
                    options={groceryNames}
                    defaultValue={r.name}
                    noun="name"
                    onValueChange={(v) => update(r.id, { name: v, confirmed: true })}
                  />
                </div>
                <div>
                  <Label htmlFor={`${r.id}-qty`}>Qty</Label>
                  <Input
                    id={`${r.id}-qty`}
                    type="number"
                    min="0.01"
                    step="any"
                    inputMode="decimal"
                    value={r.quantity}
                    onChange={(e) => update(r.id, { quantity: e.target.value })}
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor={`${r.id}-price`}>Price (R)</Label>
                  <Input
                    id={`${r.id}-price`}
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={r.lineTotal}
                    onChange={(e) => update(r.id, { lineTotal: e.target.value, confirmed: true })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRows((all) => all.filter((x) => x.id !== r.id))}
                  aria-label={`Remove ${r.name || "item"}`}
                  className="mb-1.5 grid h-9 w-9 place-items-center rounded-full text-ivory/40 hover:bg-white/[0.07] hover:text-coral"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <Label htmlFor={`${r.id}-cat`}>Category</Label>
                  {scope === "shared" ? (
                    <Select
                      id={`${r.id}-cat`}
                      value={r.sharedCategoryId}
                      onChange={(e) => update(r.id, { sharedCategoryId: e.target.value })}
                    >
                      <option value="">Choose…</option>
                      {sharedCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Combobox
                      key={`${r.id}-personal`}
                      id={`${r.id}-cat`}
                      name={`${r.id}-cat`}
                      options={categoryOptions}
                      defaultValue={r.personalCategory}
                      noun="category"
                      onValueChange={(v) => update(r.id, { personalCategory: v })}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <Label htmlFor={`${r.id}-sub`}>Sub-category</Label>
                  <Combobox
                    key={`${r.id}-${scope}-sub`}
                    id={`${r.id}-sub`}
                    name={`${r.id}-sub`}
                    options={subOptions}
                    defaultValue={scope === "shared" ? r.sharedSub : r.personalSub}
                    noun="sub-category"
                    onValueChange={(v) => update(r.id, scope === "shared" ? { sharedSub: v } : { personalSub: v })}
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ivory/40">
                {r.raw && <span>Receipt says “{r.raw}”</span>}
                {r.remembered && <span className="text-mint">Filled in from last time</span>}
                {flagged && (
                  <button
                    type="button"
                    onClick={() => update(r.id, { confirmed: true })}
                    className="ml-auto rounded-full bg-gold/15 px-3 py-1 font-semibold text-gold hover:bg-gold/25"
                  >
                    Looks right
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            setRows((all) => [
              ...all,
              {
                id: `n${Date.now()}`,
                raw: "",
                name: "",
                quantity: "1",
                lineTotal: "",
                sharedCategoryId: all[all.length - 1]?.sharedCategoryId ?? sharedCategories[0]?.id ?? "",
                personalCategory: all[all.length - 1]?.personalCategory ?? "",
                sharedSub: "",
                personalSub: "",
                issues: [],
                confirmed: true,
                crop: null,
                remembered: false,
              },
            ])
          }
        >
          + Add an item
        </Button>
      </div>

      {/* Does it add up? */}
      <div id="receipt-balance" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
          <span className="text-ivory/60">
            Items <span className="font-semibold tabular text-ivory">{money(itemsCents)}</span> · Receipt{" "}
            <span className="font-semibold tabular text-ivory">{total ? money(totalCents) : "—"}</span>
          </span>
          {total && difference === 0 && rows.length > 0 && <span className="font-semibold text-mint">✓ Adds up</span>}
        </div>
        {total && difference !== 0 && rows.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setRows((all) => [
                  ...all,
                  {
                    id: `d${Date.now()}`,
                    raw: "",
                    name: difference > 0 ? "Other items" : "Discount",
                    quantity: "1",
                    lineTotal: (difference / 100).toFixed(2),
                    sharedCategoryId: all[0]?.sharedCategoryId ?? sharedCategories[0]?.id ?? "",
                    personalCategory: all[0]?.personalCategory ?? "",
                    sharedSub: "",
                    personalSub: "",
                    issues: [],
                    confirmed: true,
                    crop: null,
                    remembered: false,
                  },
                ])
              }
            >
              Add {money(Math.abs(difference))} as {difference > 0 ? "other items" : "a discount"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setTotal((itemsCents / 100).toFixed(2))}>
              The items are right: use {money(itemsCents)}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" disabled={checks.length > 0 || saving} onClick={save}>
          {saving
            ? "Saving…"
            : checks.length
              ? `Check ${checks.length} thing${checks.length === 1 ? "" : "s"} first`
              : `Save ${money(totalCents)}`}
        </Button>
        <Button type="button" variant="ghost" onClick={reset}>
          Start over
        </Button>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M3 6.5h3l1.5-2h5L14 6.5h3v9H3z" strokeLinejoin="round" />
      <circle cx="10" cy="11" r="3" />
    </svg>
  );
}
