import CmsPage, { cmsMetadata } from "@/components/site/CmsPage";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return cmsMetadata(slug);
}

export default async function Page({ params }) {
  const { slug } = await params;
  return <CmsPage slug={slug} />;
}
