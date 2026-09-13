import { useState, useEffect, useRef } from "react";

// Considera o teclado virtual aberto quando a visual viewport encolhe
// significativamente em relação à maior altura já vista (mesma largura).
//
// Não dá pra comparar contra window.innerHeight diretamente: com a meta tag
// interactive-widget=resizes-content (usada em public/index.html pra corrigir
// o vão entre teclado e input), alguns navegadores encolhem window.innerHeight
// junto com a visual viewport quando o teclado abre — a diferença entre os
// dois fica sempre perto de zero e o teclado nunca é detectado como aberto.
// Por isso guardamos a maior altura observada (sem teclado) como referência.
const KEYBOARD_HEIGHT_THRESHOLD = 150;

export default function useKeyboardOpen() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const baselineRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const checkKeyboard = () => {
      const currentWidth = window.innerWidth;
      const currentHeight = viewport.height;

      if (
        currentWidth !== baselineRef.current.width ||
        currentHeight > baselineRef.current.height
      ) {
        baselineRef.current = { width: currentWidth, height: currentHeight };
      }

      const heightDelta = baselineRef.current.height - currentHeight;
      setKeyboardOpen(heightDelta > KEYBOARD_HEIGHT_THRESHOLD);
    };

    checkKeyboard();
    viewport.addEventListener("resize", checkKeyboard);
    viewport.addEventListener("scroll", checkKeyboard);

    return () => {
      viewport.removeEventListener("resize", checkKeyboard);
      viewport.removeEventListener("scroll", checkKeyboard);
    };
  }, []);

  return keyboardOpen;
}
