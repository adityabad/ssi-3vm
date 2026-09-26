/**
 * RealQRCode — generates a real, scannable QR code using qrcode.react.
 * Renders as SVG (no canvas, no useEffect issues).
 *
 * Usage:
 *   <RealQRCode value="https://..." size={180} />
 */
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function RealQRCode({
  value,
  size = 180,
  bgColor = '#ffffff',
  fgColor = '#0f172a',
  level = 'H',        // L / M / Q / H  (H = highest error correction)
  style = {},
  includeMargin = true,
}) {
  if (!value) {
    return (
      <div style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f1f5f9', borderRadius: '8px',
        color: '#94a3b8', fontSize: '11px'
      }}>
        No data
      </div>
    );
  }

  return (
    <QRCodeSVG
      value={value}
      size={size}
      bgColor={bgColor}
      fgColor={fgColor}
      level={level}
      includeMargin={includeMargin}
      style={{ display: 'block', borderRadius: '6px', ...style }}
    />
  );
}
