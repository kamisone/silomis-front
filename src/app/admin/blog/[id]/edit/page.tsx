import type { Metadata } from "next";
import BlogPostEditor from "@/components/admin/blog/BlogPostEditorClient";

export const metadata: Metadata = { title: "Edit article — Admin" };

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BlogPostEditor postId={id} />;
}
