/** Chân trang: chỗ duy nhất còn lại để gọi hỗ trợ sau khi bỏ thanh tab. */
export function ChanTrang() {
  return (
    <footer className="an-toan-duoi mx-auto max-w-xl px-5 pb-8 pt-10">
      <div className="kinh flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[13px] text-faint">Cần hỗ trợ</p>
          <a
            href="mailto:support@therahomeai.com"
            className="mt-0.5 block truncate text-[14px] font-medium text-soft"
          >
            support@therahomeai.com
          </a>
        </div>
        <a
          href="tel:+84364263552"
          className="flex shrink-0 items-center gap-2 rounded-full bg-inset px-4 py-2.5 text-[15px] font-semibold text-text active:opacity-70"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6.2 3.8h3l1.5 3.8-2 1.4a12 12 0 0 0 5.3 5.3l1.4-2 3.8 1.5v3a1.7 1.7 0 0 1-1.9 1.7A16.2 16.2 0 0 1 4.5 5.7 1.7 1.7 0 0 1 6.2 3.8Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          Gọi
        </a>
      </div>
    </footer>
  );
}
