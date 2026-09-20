"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { LandingButton } from "@/components/landing/LandingButton";
import styles from "./ProductScrollHero.module.css";

const THERAPIES = ["Kéo giãn 26°", "Xung điện EMS", "Nhiệt 40–42°C", "Massage nhịp nhàng"];

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const segment = (progress: number, from: number, to: number) => smooth((progress - from) / (to - from));

type StoryStyle = React.CSSProperties & Record<`--${string}`, string | number>;

const initialStyle: StoryStyle = {
  "--intro-out": 0,
  "--place": 0,
  "--handoff": 0,
  "--use-copy": 0,
  "--use-out": 0,
  "--bundle": 0,
  "--bundle-out": 0,
  "--app": 0,
  "--app-out": 0,
  "--close": 0,
  "--mx": 0,
  "--my": 0,
};

export function ProductScrollHero() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [mediaStage, setMediaStage] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let target = 0;
    let current = 0;
    let frame = 0;
    let loadedMediaStage = 0;

    const render = () => {
      frame = 0;
      current += (target - current) * (reducedMotion.matches ? 1 : 0.14);
      if (Math.abs(target - current) < 0.0005) current = target;

      track.style.setProperty("--intro-out", String(segment(current, 0.09, 0.20)));
      track.style.setProperty("--place", String(segment(current, 0.12, 0.34)));
      track.style.setProperty("--handoff", String(segment(current, 0.23, 0.32)));
      track.style.setProperty("--use-copy", String(segment(current, 0.27, 0.38)));
      track.style.setProperty("--use-out", String(segment(current, 0.46, 0.56)));
      track.style.setProperty("--bundle", String(segment(current, 0.51, 0.66)));
      track.style.setProperty("--bundle-out", String(segment(current, 0.68, 0.76)));
      track.style.setProperty("--app", String(segment(current, 0.71, 0.84)));
      track.style.setProperty("--app-out", String(segment(current, 0.85, 0.91)));
      track.style.setProperty("--close", String(segment(current, 0.87, 0.98)));

      const neededMediaStage = current > 0.62 ? 3 : current > 0.38 ? 2 : current > 0.08 ? 1 : 0;
      if (neededMediaStage > loadedMediaStage) {
        loadedMediaStage = neededMediaStage;
        setMediaStage(neededMediaStage);
      }

      const scene = current < 0.2 ? 0 : current < 0.51 ? 1 : current < 0.71 ? 2 : current < 0.87 ? 3 : 4;
      track.dataset.scene = String(scene);

      if (current !== target) frame = window.requestAnimationFrame(render);
    };

    const measure = () => {
      const rect = track.getBoundingClientRect();
      const distance = Math.max(1, track.offsetHeight - window.innerHeight);
      target = clamp(-rect.top / distance);
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || reducedMotion.matches) return;
      track.style.setProperty("--mx", String((event.clientX / window.innerWidth - 0.5) * 2));
      track.style.setProperty("--my", String((event.clientY / window.innerHeight - 0.5) * 2));
    };

    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", onPointerMove);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={trackRef} className={styles.track} style={initialStyle} data-scene="0">
      <section className={styles.stage} aria-label="Khám phá bộ giải pháp TheraNECK+">
        <div className={styles.ambient} aria-hidden="true" />

        <div className={styles.usageScene} aria-hidden="true">
          {mediaStage >= 1 ? <Image className={styles.usageImage} src="/landing/product-story/theraneck-in-use.png" alt="" fill sizes="100vw" /> : null}
          <div className={styles.usageShade} />
        </div>

        <div className={styles.introCopy}>
          <span className={styles.kicker}>Bộ giải pháp chăm sóc cổ tại nhà</span>
          <h1>TheraNECK<span>+</span></h1>
          <p>Không chỉ là một chiếc máy. Đây là cách bạn chủ động chăm sóc cổ mỗi ngày.</p>
          <ul className={styles.therapyList} aria-label="Bốn liệu pháp của TheraNECK+">
            {THERAPIES.map((therapy) => <li key={therapy}>{therapy}</li>)}
          </ul>
        </div>

        <div className={styles.heroDevice} aria-hidden="true">
          <div className={styles.deviceHalo} />
          <Image className={styles.deviceImage} src="/landing/device.png" alt="" width={1024} height={788} sizes="(max-width: 760px) 88vw, 58vw" loading="eager" fetchPriority="high" />
          <span className={styles.deviceShadow} />
        </div>

        <div className={`${styles.sceneCopy} ${styles.useCopy}`}>
          <span className={styles.step}>01 · Đặt đúng vị trí</span>
          <h2>Thả lỏng. Để thiết bị nâng đỡ vùng cổ.</h2>
          <p>Thiết kế ôm theo đường cong cổ, đưa các bề mặt tiếp xúc đến đúng vùng cần thư giãn.</p>
        </div>

        <div className={styles.bundleScene} aria-hidden="true">
          <div className={styles.bundleGlow} />
          <div className={styles.bundleMain}>
            {mediaStage >= 2 ? <Image src="/landing/product-story/device-and-pillow.png" alt="" fill sizes="(max-width: 760px) 92vw, 62vw" /> : null}
          </div>
          <div className={styles.patchCard}>
            {mediaStage >= 2 ? <Image src="/landing/product-story/herbal-patches.png" alt="" fill sizes="(max-width: 760px) 28vw, 15vw" /> : null}
          </div>
        </div>

        <div className={`${styles.sceneCopy} ${styles.bundleCopy}`}>
          <span className={styles.step}>02 · Chăm sóc trọn ngày</span>
          <h2>Một bộ giải pháp, nhiều thời điểm sử dụng.</h2>
          <p>TheraNECK+ cho phiên thư giãn chủ động, gối công thái học nâng đỡ khi nghỉ và miếng dán nóng hỗ trợ khi cần.</p>
        </div>

        <div className={styles.appScene} aria-hidden="true">
          <div className={styles.phoneGlow} />
          <div className={styles.phoneCard}>
            {mediaStage >= 3 ? <Image src="/landing/product-story/app-journey.png" alt="" fill sizes="(max-width: 760px) 54vw, 24vw" /> : null}
          </div>
          <div className={styles.dayPill}><strong>14</strong><span>ngày có hướng dẫn</span></div>
        </div>

        <div className={`${styles.sceneCopy} ${styles.appCopy}`}>
          <span className={styles.step}>03 · Duy trì đúng lộ trình</span>
          <h2>Mỗi ngày biết mình cần làm gì.</h2>
          <p>Video hướng dẫn, nhắc lịch và tiến độ trong app giúp một thiết bị trở thành thói quen chăm sóc rõ ràng.</p>
        </div>

        <div className={styles.closingScene}>
          <div className={styles.closingProduct} aria-hidden="true">
            <Image src="/landing/device.png" alt="" width={1024} height={788} sizes="(max-width: 760px) 72vw, 42vw" />
          </div>
          <div className={styles.closingCopy}>
            <span className={styles.kicker}>TheraNECK+</span>
            <h2>Một hành trình liền mạch từ thư giãn đến duy trì.</h2>
            <p>Thiết bị 4 trong 1, phụ kiện hỗ trợ và lộ trình 14 ngày trong cùng một bộ giải pháp.</p>
            <div className={styles.actions}>
              <LandingButton href="#mua-hang">Xem giá &amp; bộ quà tặng</LandingButton>
              <LandingButton href="#lieu-phap-4" variant="secondary">Khám phá 4 liệu pháp</LandingButton>
            </div>
          </div>
        </div>

        <ol className={styles.progressRail} aria-label="Tiến trình câu chuyện sản phẩm">
          {["Thiết bị", "Sử dụng", "Bộ giải pháp", "Lộ trình", "Bắt đầu"].map((label, index) => (
            <li key={label} data-index={index}><span /><em>{label}</em></li>
          ))}
        </ol>

        <div className={styles.scrollHint} aria-hidden="true"><span>Cuộn để khám phá</span><i /></div>
      </section>
    </div>
  );
}
