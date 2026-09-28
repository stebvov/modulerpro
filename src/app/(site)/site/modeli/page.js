import CmsPage, { cmsMetadata } from "@/components/site/CmsPage";

export const generateMetadata = () => cmsMetadata("modeli");

export default function Models() {
  return <CmsPage slug="modeli" />;
}
