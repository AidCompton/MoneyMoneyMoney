import QRCode from "qrcode";

/** The address to open on your phones, as text and as a QR code for the camera. */
export async function PhoneSetup({ urls, localName }: { urls: string[]; localName: string | null }) {
  const primary = urls[0];
  if (!primary) {
    return (
      <p className="text-sm text-ivory/55">
        This computer doesn&apos;t seem to be on a home network right now. Connect it to your Wi-Fi to use the app on
        your phones.
      </p>
    );
  }
  const qr = await QRCode.toString(`${primary}/dashboard`, {
    type: "svg",
    margin: 1,
    color: { dark: "#06110dff", light: "#f4efe3ff" },
  });

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div
        aria-label={`QR code for ${primary}`}
        role="img"
        className="h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-ivory p-2 [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: qr }}
      />
      <div className="min-w-0 space-y-3 text-sm text-ivory/65">
        <p>
          On each iPhone, on the same Wi-Fi as this computer, point the Camera at the code (or type{" "}
          <span className="font-semibold text-ivory">{primary}</span> into Safari).
        </p>
        <p>
          Then tap <span className="font-semibold text-ivory">Share → Add to Home Screen</span>. It opens full screen
          like any other app.
        </p>
        {localName && (
          <p className="text-ivory/45">
            If the number above ever changes, try <span className="text-ivory/70">{localName}</span> instead.
          </p>
        )}
      </div>
    </div>
  );
}
