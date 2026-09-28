import CmsPage, { cmsMetadata } from "@/components/site/CmsPage";

export const generateMetadata = () => cmsMetadata("kejsy");

export default function Cases() {
  return <CmsPage slug="kejsy" />;
}
