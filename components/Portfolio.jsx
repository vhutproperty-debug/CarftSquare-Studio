import GalleryViewer from '@/components/GalleryViewer';

export default function Portfolio({ projects = [] }) {
  return (
    <GalleryViewer
      items={projects}
      featuredOnly
      showViewAllLink
      sectionId="projects"
      eyebrow="Project showcase"
      title="Premium interior transformations across Mumbai"
      subtitle="Featured residential, commercial, rental and modular projects from our portfolio."
    />
  );
}
