"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { AnalysisResult } from "@/types/analysis";
import { cn } from "@/lib/utils";

type PdfExportDropdownProps = {
  isOpen: boolean;
  onClose: () => void;
  result: AnalysisResult;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
};

type ExportOptions = {
  summary: boolean;
  transcript: boolean;
  tempo: boolean;
  confidence: boolean;
  mistakes: boolean;
  structure: boolean;
  idealText: boolean;
  personaFeedback: boolean;
};

type Html2CanvasOptions = Parameters<typeof html2canvas>[1];

export function PdfExportDropdown({ isOpen, onClose, result, buttonRef }: PdfExportDropdownProps) {
  const [options, setOptions] = useState<ExportOptions>({
    summary: true,
    transcript: true,
    tempo: true,
    confidence: true,
    mistakes: true,
    structure: false,
    idealText: false,
    personaFeedback: !!result.persona_feedback,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const transcriptChunks = useMemo(() => {
    const words = result.transcript?.flatMap((seg) => seg.words) ?? [];
    const chunkSize = 600;
    const chunks: typeof words[] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize));
    }
    return chunks;
  }, [result.transcript]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, buttonRef]);

  const toggleOption = (key: keyof ExportOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const generatePdf = async () => {
    if (!pdfContentRef.current) return;
    setIsGenerating(true);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      let cursorY = margin;

      const ensureBackground = () => {
        pdf.setFillColor(10, 10, 10);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
      };

      ensureBackground();

      const blocks = Array.from(
        pdfContentRef.current.querySelectorAll<HTMLElement>("[data-pdf-block]")
      );

      for (const block of blocks) {
        const canvasOptions = {
          scale: 2,
          backgroundColor: "#0a0a0a",
          logging: false,
          useCORS: true,
        } as Html2CanvasOptions;
        const canvas = await html2canvas(block, canvasOptions);

        const isSliceable = block.getAttribute("data-pdf-slice") === "true";

        const imgData = canvas.toDataURL("image/png");

        const drawWidth = contentWidth;
        const drawHeight = (canvas.height * contentWidth) / canvas.width;
        const offsetX = margin;

        if (isSliceable) {
          let used = 0;
          while (used < drawHeight - 0.1) {
            const available = pageHeight - margin - cursorY;
            if (available <= 2) {
              pdf.addPage();
              ensureBackground();
              cursorY = margin;
              continue;
            }

            pdf.addImage(imgData, "PNG", offsetX, cursorY - used, drawWidth, drawHeight);
            used += available;

            if (used < drawHeight - 0.1) {
              pdf.addPage();
              ensureBackground();
              cursorY = margin;
            } else {
              cursorY += (drawHeight - (used - available)) + 6;
            }
          }
        } else {
          const maxBlockHeight = pageHeight - margin * 2;
          let finalWidth = drawWidth;
          let finalHeight = drawHeight;

          if (finalHeight > maxBlockHeight) {
            const scaleFactor = maxBlockHeight / finalHeight;
            finalHeight = maxBlockHeight;
            finalWidth = finalWidth * scaleFactor;
          }

          if (cursorY + finalHeight > pageHeight - margin) {
            pdf.addPage();
            ensureBackground();
            cursorY = margin;
          }

          const centeredX = margin + (contentWidth - finalWidth) / 2;
          pdf.addImage(imgData, "PNG", centeredX, cursorY, finalWidth, finalHeight);
          cursorY += finalHeight + 6;
        }
      }

      pdf.save(`charisma-report-${result.task_id.slice(0, 8)}.pdf`);
      onClose();
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const optionsList = [
    { key: "summary" as const, label: "Статистика" },
    { key: "confidence" as const, label: "Уверенность" },
    { key: "tempo" as const, label: "Темп речи" },
    { key: "transcript" as const, label: "Транскрипция" },
    { key: "mistakes" as const, label: "Ошибки" },
    { key: "structure" as const, label: "Структура" },
    { key: "idealText" as const, label: "Идеальный текст" },
    { key: "personaFeedback" as const, label: "Фидбэк персоны", disabled: !result.persona_feedback },
  ];

  return (
    <>
      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className={cn(
          "absolute right-0 top-full mt-2 z-50 w-[260px] rounded-xl border border-white/15 bg-[#0c0c0c]/95 backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-200",
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
        )}
      >
        {/* Options List */}
        <div className="p-3 space-y-1">
          {optionsList.map((opt) => (
            <button
              key={opt.key}
              onClick={() => !opt.disabled && toggleOption(opt.key)}
              disabled={opt.disabled}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all",
                opt.disabled && "opacity-30 cursor-not-allowed",
                options[opt.key]
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white/80"
              )}
            >
              <span>{opt.label}</span>
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center transition-all",
                options[opt.key] 
                  ? "bg-white border-white" 
                  : "border-white/30"
              )}>
                {options[opt.key] && (
                  <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/[0.02]">
          <span className="text-xs text-white/40">
            {Object.values(options).filter(Boolean).length} из {optionsList.length} выбрано
          </span>
          <button
            onClick={generatePdf}
            disabled={isGenerating || Object.values(options).every(v => !v)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
              isGenerating || Object.values(options).every(v => !v)
                ? "bg-white/10 text-white/30 cursor-not-allowed"
                : "bg-white text-black hover:bg-white/90 shadow-lg"
            )}
          >
            {isGenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Генерация...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Скачать PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hidden PDF Content */}
      <div className="fixed left-[-9999px] top-0">
        <div 
          ref={pdfContentRef}
          style={{ 
            width: "750px",
            fontFamily: "Arial, Helvetica, sans-serif",
            backgroundColor: "#0a0a0a",
            color: "#ffffff",
            padding: "0"
          }}
        >
          {/* PDF Header */}
          <div 
            data-pdf-block
            style={{ 
              padding: "16px 20px",
              backgroundColor: "#0a0a0a"
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "top" }}>
                    <h1 style={{ fontSize: "28px", fontWeight: "bold", margin: 0, color: "#fff" }}>Charisma</h1>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", margin: "4px 0 0 0" }}>
                      Отчёт по анализу выступления
                    </p>
                  </td>
                  <td style={{ verticalAlign: "top", textAlign: "right", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                    <p style={{ margin: 0 }}>ID: {result.task_id.slice(0, 8)}</p>
                    <p style={{ margin: "2px 0 0 0" }}>{new Date().toLocaleDateString("ru-RU")}</p>
                    {result.analyze_provider && result.analyze_model && (
                      <p style={{ margin: "4px 0 0 0", color: "rgba(255,255,255,0.6)" }}>
                        {result.analyze_provider}/{result.analyze_model}
                      </p>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Stats */}
          {options.summary && (
            <div 
              data-pdf-block
              style={{ 
                padding: "12px 20px",
                backgroundColor: "#0a0a0a"
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px", color: "#fff" }}>Общая статистика</h2>
              <div>
                {[
                  { label: "Паразиты", value: result.fillers_summary.count, sub: `${(result.fillers_summary.ratio * 100).toFixed(1)}%` },
                  { label: "Уверенность", value: result.confidence_index.total.toFixed(0), sub: "из 100" },
                  { label: "Плотность", value: `${result.slide_text_density?.toFixed(1) || 0}%`, sub: "" },
                  { label: "Фрагментов", value: result.transcript.length, sub: "" },
                ].map((item, idx) => (
                  <div 
                    key={item.label}
                    style={{ 
                      display: "inline-block",
                      width: "168px",
                      marginRight: idx < 3 ? "10px" : 0,
                      verticalAlign: "top",
                      borderRadius: "12px", 
                      backgroundColor: "rgba(255,255,255,0.05)", 
                      padding: "14px", 
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxSizing: "border-box"
                    }}
                  >
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: "22px", fontWeight: "bold", margin: "6px 0 2px 0", color: "#fff" }}>{item.value}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: 0, minHeight: "14px" }}>{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence */}
          {options.confidence && (
            <div 
              data-pdf-block
              style={{ 
                padding: "12px 20px",
                backgroundColor: "#0a0a0a"
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px", color: "#fff" }}>Индекс уверенности: {result.confidence_index.total.toFixed(0)}/100</h2>
              <div style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.05)", padding: "16px", border: "1px solid rgba(255,255,255,0.1)" }}>
                {[
                  { label: "Громкость", value: result.confidence_index.components.volume_score },
                  { label: "Паразиты", value: result.confidence_index.components.filler_score },
                  { label: "Взгляд", value: result.confidence_index.components.gaze_score },
                  { label: "Жесты", value: result.confidence_index.components.gesture_score || 0 },
                ].map((item, idx) => (
                  <div key={item.label} style={{ marginBottom: idx < 3 ? "10px" : 0 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "6px" }}>
                      <tbody>
                        <tr>
                          <td style={{ color: "rgba(255,255,255,0.6)" }}>{item.label}</td>
                          <td style={{ textAlign: "right", color: "#fff" }}>{(item.value || 0).toFixed(0)}%</td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ position: "relative", height: "8px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "8px", width: `${item.value || 0}%`, backgroundColor: "#fff", borderRadius: "4px" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tempo */}
          {options.tempo && result.tempo.length > 0 && (() => {
            const tempoData = result.tempo.slice(0, 60);
            const maxWpm = Math.max(...result.tempo.map(p => p.wpm));
            const barWidth = Math.floor(700 / tempoData.length) - 2;
            return (
              <div 
                data-pdf-block
                style={{ 
                  padding: "12px 20px",
                  backgroundColor: "#0a0a0a"
                }}
              >
                <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px", color: "#fff" }}>Темп речи (среднее: {(result.tempo.reduce((a, b) => a + b.wpm, 0) / result.tempo.length).toFixed(0)} WPM)</h2>
                <div style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.05)", padding: "16px", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ position: "relative", height: "80px", width: "100%" }}>
                    {tempoData.map((point, i) => {
                      const height = (point.wpm / maxWpm) * 80;
                      const color = point.zone === "red" ? "#ef4444" : point.zone === "yellow" ? "#f59e0b" : "rgba(255,255,255,0.5)";
                      return (
                        <div 
                          key={i}
                          style={{ 
                            position: "absolute",
                            bottom: 0,
                            left: `${i * (barWidth + 2)}px`,
                            width: `${barWidth}px`,
                            height: `${height}px`, 
                            backgroundColor: color,
                            borderRadius: "2px 2px 0 0"
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Transcript */}
          {options.transcript &&
            transcriptChunks.map((chunk, idx) => (
              <div
                key={`transcript-${idx}`}
                data-pdf-block
                data-pdf-slice="true"
                style={{
                  padding: idx === 0 ? "12px 20px" : "0 20px 12px 20px",
                  backgroundColor: "#0a0a0a",
                }}
              >
                {idx === 0 && (
                  <h2
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      marginBottom: "10px",
                      color: "#fff",
                    }}
                  >
                    Транскрипция
                  </h2>
                )}
                <div
                  style={{
                    borderRadius: "0px",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    padding: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontSize: "12px",
                    lineHeight: "1.7",
                  }}
                >
                  {chunk.map((word, i) => (
                    <span
                      key={`${idx}-${i}-${word.text}-${word.start}`}
                      style={
                        word.is_filler
                          ? {
                              color: "#fb7185",
                              backgroundColor: "transparent",
                              padding: "0",
                              borderRadius: "0",
                            }
                          : { color: "rgba(255,255,255,0.8)" }
                      }
                    >
                      {word.text}{" "}
                    </span>
                  ))}
                </div>
              </div>
            ))}

          {/* Mistakes */}
          {options.mistakes && result.mistakes && (
            <div 
              data-pdf-block
              style={{ 
                padding: "12px 20px",
                backgroundColor: "#0a0a0a"
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px", color: "#fff" }}>Ошибки</h2>
              <div style={{ borderRadius: "12px", backgroundColor: "rgba(239,68,68,0.08)", padding: "20px", border: "1px solid rgba(239,68,68,0.25)", fontSize: "13px", lineHeight: "1.7", color: "rgba(255,255,255,0.85)" }}>
                {result.mistakes}
              </div>
            </div>
          )}

          {/* Structure */}
          {options.structure && result.structure && (
            <div 
              data-pdf-block
              style={{ 
                padding: "12px 20px",
                backgroundColor: "#0a0a0a"
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px", color: "#fff" }}>Структура</h2>
              <div style={{ borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.05)", padding: "20px", border: "1px solid rgba(255,255,255,0.1)", fontSize: "13px", lineHeight: "1.7", color: "rgba(255,255,255,0.85)" }}>
                {result.structure}
              </div>
            </div>
          )}

          {/* Ideal */}
          {options.idealText && result.ideal_text && (
            <div 
              data-pdf-block
              style={{ 
                padding: "12px 20px",
                backgroundColor: "#0a0a0a"
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px", color: "#fff" }}>Идеальный текст</h2>
              <div style={{ borderRadius: "12px", backgroundColor: "rgba(16,185,129,0.08)", padding: "20px", border: "1px solid rgba(16,185,129,0.25)", fontSize: "13px", lineHeight: "1.7", color: "rgba(255,255,255,0.85)" }}>
                {result.ideal_text}
              </div>
            </div>
          )}

          {/* Persona */}
          {options.personaFeedback && result.persona_feedback && (
            <div 
              data-pdf-block
              style={{ 
                padding: "12px 20px",
                backgroundColor: "#0a0a0a"
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "10px", color: "#fff" }}>Фидбэк персоны</h2>
              <div style={{ borderRadius: "12px", backgroundColor: "rgba(245,158,11,0.08)", padding: "20px", border: "1px solid rgba(245,158,11,0.25)", fontSize: "13px", lineHeight: "1.7", color: "rgba(255,255,255,0.85)" }}>
                {result.persona_feedback}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

