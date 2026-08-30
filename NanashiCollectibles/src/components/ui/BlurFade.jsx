import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// Aliased to a plain identifier — this project's eslint config has no
// eslint-plugin-react, so its JS-only no-unused-vars scope analysis doesn't
// recognize a dotted JSX tag name (motion.div) as a usage of `motion`.
const MotionDiv = motion.div;

// Adapted from magicui's Blur Fade (21st.dev/@dillionverma/components/blur-fade).
// Differences from the original: no AnimatePresence/exit (nothing here unmounts),
// visible.y settles at 0 instead of -yOffset (the original leaves a permanent
// upward offset once settled), and motion is skipped for prefers-reduced-motion
// via useReducedMotion — the project's global CSS transition-duration override
// only catches CSS transitions, not framer-motion's own tweening.
export default function BlurFade({
  children,
  className = "",
  duration = 0.3,
  delay = 0,
  yOffset = 6,
  inView = false,
  inViewMargin = "-50px",
  blur = "6px",
}) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin });
  const isInView = !inView || inViewResult;
  const prefersReducedMotion = useReducedMotion();

  const variants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
        visible: { y: 0, opacity: 1, filter: "blur(0px)" },
      };

  return (
    <MotionDiv
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      transition={{
        delay: prefersReducedMotion ? 0 : delay,
        duration: prefersReducedMotion ? 0 : duration,
        ease: "easeOut",
      }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}
