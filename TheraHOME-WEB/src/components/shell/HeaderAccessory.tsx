"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const HEADER_ACCESSORY_SLOT_ID = "page-header-accessory-slot";

/** Renders its children into the slot AppShell keeps right next to the
 * page title (e.g. the VN/UK/ML market dropdown beside "Sản Phẩm"), so a
 * view can put a control in the topbar while keeping the control's state
 * local to the view. The slot lookup runs in an effect because the portal
 * target only exists after mount (SSR renders no DOM). */
export function HeaderAccessory({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Portal-target lookup is genuine external-system (DOM) sync: the slot
    // node can't be read during render (SSR has no document) and never
    // changes after mount, so this sets state exactly once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlot(document.getElementById(HEADER_ACCESSORY_SLOT_ID));
  }, []);
  return slot ? createPortal(children, slot) : null;
}
