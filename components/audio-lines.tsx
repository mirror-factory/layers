"use client";

import { useMemo } from "react";

type AudioLinesState = "idle" | "recording" | "processing" | "completed";

interface AudioLinesProps {
  state: AudioLinesState;
  className?: string;
}

const LAYERS_MINT = "var(--layers-mint)";
const LAYERS_WARNING = "var(--signal-warning)";

export function AudioLines({ state, className = "" }: AudioLinesProps) {
  const lines = useMemo(() => {
    if (state === "processing" || state === "completed") {
      return [{ color: state === "completed" ? LAYERS_MINT : "#ffffff", delay: 0 }];
    }
    return [
      { color: LAYERS_MINT, delay: 0 },
      { color: "#ffffff", delay: 0.4 },
      { color: LAYERS_WARNING, delay: 0.8 },
    ];
  }, [state]);

  return (
    <div
      className={`audio-lines audio-lines--${state} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        className="audio-lines__svg"
      >
        {lines.map((line, i) => (
          <path
            key={`${state}-${i}`}
            className={`audio-line audio-line--${state}`}
            stroke={line.color}
            strokeOpacity={state === "completed" ? 0.6 : line.color === LAYERS_WARNING ? 0.35 : 0.8}
            fill="none"
            style={{ animationDelay: `${line.delay}s` }}
          />
        ))}
      </svg>

      <style jsx>{`
        .audio-lines {
          position: relative;
          width: 100%;
          height: 80px;
          overflow: hidden;
        }

        .audio-lines__svg {
          width: 100%;
          height: 100%;
        }

        .audio-line {
          stroke-width: 1.5;
          stroke-linecap: round;
        }

        /* Idle: gentle undulation */
        .audio-line--idle {
          d: path("M 0,50 C 50,45 100,55 150,50 C 200,45 250,55 300,50 C 350,45 400,50 400,50");
          animation: wave-idle 4s ease-in-out infinite alternate;
          stroke-width: 1.2;
        }

        /* Recording: energetic waves */
        .audio-line--recording {
          d: path("M 0,50 C 40,20 80,80 120,50 C 160,20 200,80 240,50 C 280,20 320,80 360,50 L 400,50");
          animation: wave-recording 1.2s ease-in-out infinite alternate;
          stroke-width: 2.5;
        }

        /* Processing: converged shimmer line */
        .audio-line--processing {
          d: path("M 0,50 L 400,50");
          animation: shimmer 1.5s ease-in-out infinite;
          stroke-width: 2;
        }

        /* Completed: solid fade */
        .audio-line--completed {
          d: path("M 0,50 L 400,50");
          animation: fade-out 2s ease-out forwards;
          stroke-width: 2;
        }

        @keyframes wave-idle {
          0% {
            d: path("M 0,50 C 50,45 100,55 150,50 C 200,45 250,55 300,50 C 350,45 400,50 400,50");
          }
          50% {
            d: path("M 0,50 C 50,55 100,42 150,50 C 200,58 250,42 300,50 C 350,55 400,48 400,50");
          }
          100% {
            d: path("M 0,50 C 50,42 100,58 150,50 C 200,42 250,58 300,50 C 350,42 400,52 400,50");
          }
        }

        @keyframes wave-recording {
          0% {
            d: path("M 0,50 C 40,20 80,80 120,50 C 160,20 200,80 240,50 C 280,20 320,80 360,50 L 400,50");
          }
          33% {
            d: path("M 0,50 C 40,75 80,25 120,50 C 160,75 200,25 240,50 C 280,75 320,25 360,50 L 400,50");
          }
          66% {
            d: path("M 0,50 C 40,15 80,85 120,50 C 160,15 200,85 240,50 C 280,15 320,85 360,50 L 400,50");
          }
          100% {
            d: path("M 0,50 C 40,80 80,20 120,50 C 160,80 200,20 240,50 C 280,80 320,20 360,50 L 400,50");
          }
        }

        @keyframes shimmer {
          0%, 100% {
            stroke-opacity: 0.4;
            filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.3));
          }
          50% {
            stroke-opacity: 1;
            filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.6));
          }
        }

        @keyframes fade-out {
          0% {
            stroke-opacity: 0.8;
          }
          100% {
            stroke-opacity: 0.2;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .audio-line {
            animation: none !important;
          }
          .audio-line--idle {
            d: path("M 0,50 L 400,50");
          }
          .audio-line--recording {
            d: path("M 0,50 L 400,50");
          }
        }
      `}</style>
    </div>
  );
}
