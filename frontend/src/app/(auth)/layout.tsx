import StaffAuth from "@/components/providers/StaffAuth";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaffAuth>{children}</StaffAuth>;
}
