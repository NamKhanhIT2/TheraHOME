import { AuthPanel } from "@/components/landing/AuthPanel";

export const metadata = { title: "Đăng nhập · TheraHome" };

export default function LoginPage() {
  return <AuthPanel mode="login" />;
}
