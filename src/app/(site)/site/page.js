import CmsPage, { cmsMetadata } from "@/components/site/CmsPage";

export const generateMetadata = () => cmsMetadata("home");

export default function Home() {
  return <CmsPage slug="home" />;
}
