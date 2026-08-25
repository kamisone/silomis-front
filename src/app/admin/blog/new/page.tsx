import type { Metadata } from "next";
import BlogPostEditor from "@/components/admin/blog/BlogPostEditorClient";

export const metadata: Metadata = { title: "New article — Admin" };

export default function NewBlogPostPage() {
  return <BlogPostEditor />;
}
