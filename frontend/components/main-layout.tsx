// DEPRECATED: This component is no longer used.
// Pages should use ContentWrapper instead and rely on ProtectedLayout for header/navigation.
import { ContentWrapper } from "./content-wrapper";

export function MainLayout({ children }: { children: React.ReactNode }) {
  // For backward compatibility, just wrap in ContentWrapper
  return <ContentWrapper>{children}</ContentWrapper>;
}

