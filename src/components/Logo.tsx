export default function Logo({ size = 44 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
        <defs>
          <linearGradient id="braise" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8B4A0" />
            <stop offset="55%" stopColor="#A32E52" />
            <stop offset="100%" stopColor="#7A1F3D" />
          </linearGradient>
        </defs>
        {/* Deux flammes entrelacées : les deux partenaires */}
        <path
          d="M24 4c6 7 2 10 5 14 2.6 3.4 9 5 9 13a14 14 0 0 1-28 0c0-8 6.4-9.6 9-13 3-4-1-7 5-14Z"
          fill="url(#braise)"
        />
        <path
          d="M24 22c2.6 3.2 1 5 2.2 7 1 1.7 3.8 2.4 3.8 6a6 6 0 0 1-12 0c0-3.6 2.8-4.3 3.8-6 1.2-2-.4-3.8 2.2-7Z"
          fill="#0D0A0F"
          opacity="0.55"
        />
      </svg>
      <div className="text-center">
        <h1 className="font-display text-3xl tracking-tight text-champagne">
          my<span className="text-orrose italic">X</span>app
        </h1>
        <p className="mt-1 text-xs uppercase tracking-[0.28em] text-brume">
          Rien que vous deux
        </p>
      </div>
    </div>
  );
}
