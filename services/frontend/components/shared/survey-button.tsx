"use client";

import { useState, useEffect } from "react";

const SURVEY_URL = "https://forms.yandex.ru/cloud/69e625b590fa7b095e68ddbc";

export default function SurveyButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed bottom-0 right-0"
      style={{
        zIndex: 1200,
        opacity: visible ? 1 : 0,
        transition: "opacity 1.2s ease",
      }}
    >
      <div
        className="relative w-[340px] h-[240px]"
        style={{ transform: "scale(0.9)", transformOrigin: "bottom right" }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap');

          .hw-text {
            font-family: 'Caveat', cursive;
            font-size: 38px;
            fill: #ffffff;
          }

          .brush-main {
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke: #ffffff;
            stroke-width: 4px;
            filter: url(#brush-texture);
          }
          .brush-b1 {
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke: #ffffff;
            stroke-width: 2.5px;
            opacity: 0.5;
            filter: url(#brush-texture);
          }
          .brush-b2 {
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke: #ffffff;
            stroke-width: 1.5px;
            opacity: 0.3;
            filter: url(#brush-texture);
          }

          .brush-underline       { stroke: #ffffff; stroke-width: 3.5px; fill: none; stroke-linecap: round; filter: url(#brush-texture); }
          .brush-underline-light { stroke: #ffffff; stroke-width: 1.5px; fill: none; stroke-linecap: round; opacity: 0.5; filter: url(#brush-texture); }

          .hw-underline {
            stroke-dasharray: 200;
            stroke-dashoffset: 200;
            animation: drawPath 0.5s ease-out forwards 0.2s;
          }
          .hw-arrow {
            stroke-dasharray: 150;
            stroke-dashoffset: 150;
            animation: drawPath 0.5s ease-out forwards 0.7s;
          }
          .hw-arrow-head {
            stroke-dasharray: 60;
            stroke-dashoffset: 60;
            animation: drawPath 0.3s ease-out forwards 1.2s;
          }

          @keyframes drawPath {
            to { stroke-dashoffset: 0; }
          }
        `}</style>

        <svg
          viewBox="0 0 340 240"
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter
              id="brush-texture"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.6"
                numOctaves="2"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="1.5"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>

          <g transform="rotate(-4, 130, 70)">
            <text x="130" y="70" textAnchor="middle" className="hw-text">
              пожалуйста,
            </text>
            <text x="130" y="110" textAnchor="middle" className="hw-text">
              пройдите опрос
            </text>
            <path
              className="brush-underline hw-underline"
              d="M 30 125 Q 130 135, 220 115"
            />
            <path
              className="brush-underline-light hw-underline"
              d="M 32 127 Q 130 137, 218 117"
            />
          </g>

          <g>
            <path
              className="brush-main hw-arrow"
              d="M 140 140 Q 150 180, 230 175"
            />
            <path
              className="brush-b1 hw-arrow"
              d="M 138 138 Q 148 182, 230 177"
            />
            <path
              className="brush-b2 hw-arrow"
              d="M 142 142 Q 152 178, 230 173"
            />
            <path
              className="brush-main hw-arrow-head"
              strokeLinejoin="miter"
              d="M 215 160 L 230 175 L 215 190"
            />
            <path
              className="brush-b1 hw-arrow-head"
              strokeLinejoin="miter"
              d="M 213 158 L 230 175 L 213 192"
            />
          </g>
        </svg>

        <div className="absolute bottom-8 right-8 z-20">
          <a
            href={SURVEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Пройти опрос"
            className="group flex items-center justify-center w-14 h-14 rounded-full cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
              transition:
                "background 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.13)";
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 0 0 1px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.6)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.07)";
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 4px 24px rgba(0,0,0,0.5)";
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
