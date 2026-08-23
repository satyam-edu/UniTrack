/**
 * Shared Framer Motion transition presets.
 *
 * A small, consistent set of transitions used across the app instead of
 * scattered inline `transition={{...}}` configs. Keeping them centralized
 * means every entrance/interaction animation feels like it belongs to the
 * same system — same weight, same easing character.
 *
 * Usage:
 *   <motion.div transition={springSmooth} ... />
 *   <motion.div transition={{ ...springSmooth, delay: 0.1 }} ... />
 */

import type { Transition } from 'motion/react'

/**
 * Calm, non-bouncy spring for card/panel/page entrances and larger surfaces
 * (modals, sheets, section reveals). Moderate damping keeps it settled with
 * no visible overshoot.
 */
export const springSmooth: Transition = {
  type: 'spring',
  damping: 28,
  stiffness: 280,
}

/**
 * Slightly quicker, still controlled spring for small interactive elements —
 * buttons, toggles, pills, tab/day-switch indicators, icon rotations.
 */
export const springSnappy: Transition = {
  type: 'spring',
  damping: 24,
  stiffness: 380,
}

/**
 * Duration-based ease-out for simple opacity/x/y fade-ins (list items,
 * step transitions, toasts). A proper ease-out curve reads as smooth and
 * intentional rather than abrupt or linear.
 */
export const fadeSlide: Transition = {
  duration: 0.25,
  ease: [0.25, 0.46, 0.45, 0.94],
}
