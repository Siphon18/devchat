export const MOTION_EASE = [0.16, 1, 0.3, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: MOTION_EASE } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.16, ease: MOTION_EASE } },
};

export const fade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease: MOTION_EASE } },
  exit: { opacity: 0, transition: { duration: 0.14, ease: MOTION_EASE } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96, y: 6 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: MOTION_EASE } },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.14, ease: MOTION_EASE } },
};

export const slideDown = {
  hidden: { opacity: 0, height: 0, y: -4 },
  visible: { opacity: 1, height: "auto", y: 0, transition: { duration: 0.22, ease: MOTION_EASE } },
  exit: { opacity: 0, height: 0, y: -4, transition: { duration: 0.16, ease: MOTION_EASE } },
};

export function springIfAllowed(reduced) {
  return reduced
    ? { duration: 0.01 }
    : { type: "spring", stiffness: 360, damping: 32, mass: 0.8 };
}
