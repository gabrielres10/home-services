"use client";

import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { Amount } from "@/components/amount";
import type { FloorSettlement } from "@/lib/domain/settlement";

export function FloorStatementCard({
  floor,
  band,
}: {
  floor: FloorSettlement;
  band: number;
}) {
  const shotRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "working" | "copied" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function copyImage() {
    const node = shotRef.current;
    if (!node) {
      return;
    }
    setStatus("working");
    setMessage(null);
    try {
      const backgroundColor = getComputedStyle(node).backgroundColor || "#e8dfcf";
      const blobPromise = toBlob(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor,
      }).then((blob) => {
        if (!blob) {
          throw new Error("empty");
        }
        return blob;
      });

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blobPromise }),
        ]);
      } catch {
        const blob = await blobPromise;
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
      }

      setStatus("copied");
      setMessage("Imagen copiada. Pégala en WhatsApp.");
      window.setTimeout(() => {
        setStatus("idle");
        setMessage(null);
      }, 2500);
    } catch {
      setStatus("error");
      setMessage("No se pudo copiar la imagen. Prueba en Chrome o Edge, en el computador.");
    }
  }

  const label =
    status === "working"
      ? "Preparando imagen…"
      : status === "copied"
        ? "Imagen copiada"
        : "Copiar imagen para WhatsApp";

  return (
    <article className="floor-statement-card">
      <div
        ref={shotRef}
        className={`floor-statement floor-band-${band}`}
      >
        <header>
          <p className="kicker">Piso</p>
          <h3>{floor.floorName}</h3>
        </header>
        <p className="floor-due">
          <span className="floor-due-label">A pagar</span>
          <strong className="floor-total">
            <Amount value={floor.total} kind="money" />
          </strong>
        </p>
        <ul className="floor-breakdown">
          <li>
            <div className="floor-breakdown-main">
              <span className="floor-breakdown-name">Agua</span>
              <span className="floor-breakdown-cost">
                <Amount value={floor.waterCost} kind="money" />
              </span>
            </div>
            <p className="floor-breakdown-qty">
              <Amount value={floor.waterM3} /> m³
            </p>
            <p className="floor-breakdown-split">
              <span>
                <Amount value={floor.waterSubsidizedM3} /> m³ subsidio
              </span>
              <span>
                <Amount value={floor.waterStandardM3} /> m³ estándar
              </span>
            </p>
          </li>
          <li>
            <div className="floor-breakdown-main">
              <span className="floor-breakdown-name">Energía</span>
              <span className="floor-breakdown-cost">
                <Amount value={floor.energyCost} kind="money" />
              </span>
            </div>
            <p className="floor-breakdown-qty">
              <Amount value={floor.energyKwh} /> kWh
            </p>
            <p className="floor-breakdown-split">
              <span>
                <Amount value={floor.energySubsidizedKwh} /> kWh subsidio
              </span>
              <span>
                <Amount value={floor.energyStandardKwh} /> kWh estándar
              </span>
            </p>
          </li>
          <li>
            <div className="floor-breakdown-main">
              <span className="floor-breakdown-name">Alumbrado público</span>
              <span className="floor-breakdown-cost">
                <Amount value={floor.otherServicesApCost} kind="money" />
              </span>
            </div>
          </li>
        </ul>
      </div>
      <div className="copy-text">
        <button
          type="button"
          className="btn btn-ghost btn-full"
          disabled={status === "working"}
          onClick={() => {
            void copyImage();
          }}
        >
          {label}
        </button>
        {message ? (
          <p className={status === "error" ? "notice notice-error" : "muted text-[0.86rem]"}>
            {message}
          </p>
        ) : null}
      </div>
    </article>
  );
}
