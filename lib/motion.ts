/**
 * Shared Framer Motion variants and easing curves for the Vault.
 * Centralised so every component uses identical timing language.
 */
import type { Variants, Transition } from "framer-motion";

export const easeVault = [0.4, 0, 0.2, 1] as const;
export const easeOutVault = [0, 0, 0.2, 1] as const;
export const easeInVault = [0.4, 0, 1, 1] as const;

export const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOutVault },
  },
};

export const sectionRevealHeading: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOutVault, delay: 0.1 },
  },
};

export const sectionStagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0 },
  },
};

export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOutVault, delay: i * 0.1 },
  }),
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOutVault },
  },
};

export const springLag: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 22,
  mass: 0.5,
};
