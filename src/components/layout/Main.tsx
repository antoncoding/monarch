export default function Main({ children }: { children: React.ReactNode }) {
  return <main className="container mx-auto flex flex-col gap-8 px-4 py-6 md:px-8">{children}</main>;
}
