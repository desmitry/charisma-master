"use client";

export function Hero() {
  return (
    <section className="snap-section relative flex min-h-svh w-full items-center justify-center">
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white sm:px-6">
        <h1 className="text-[2.5rem] font-bold leading-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Улучшай свою речь <br />
          <i className="font-light">с нашей помощью</i>
        </h1>
        <p className="mt-6 max-w-xl font-mono text-xs text-foreground/60 sm:mt-8 sm:text-sm">
          Лучший AI-анализ на слова-паразиты и недочеты речи.
        </p>
      </div>
    </section>
  );
}
