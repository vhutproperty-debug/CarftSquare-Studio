import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

function buildHref(page, category) {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (category) params.set('category', category);
  const query = params.toString();
  return query ? `/blog?${query}` : '/blog';
}

function pageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

export default function BlogPagination({ page, totalPages, category = '' }) {
  if (totalPages <= 1) return null;

  const pages = pageRange(page, totalPages);
  const showEllipsis = (index) => index > 0 && pages[index] - pages[index - 1] > 1;

  return (
    <Pagination className="mt-12">
      <PaginationContent>
        {page > 1 ? (
          <PaginationItem>
            <PaginationPrevious href={buildHref(page - 1, category)} />
          </PaginationItem>
        ) : null}

        {pages.map((pageNumber, index) => (
          <span key={pageNumber} className="contents">
            {showEllipsis(index) ? (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            ) : null}
            <PaginationItem>
              <PaginationLink href={buildHref(pageNumber, category)} isActive={pageNumber === page}>
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          </span>
        ))}

        {page < totalPages ? (
          <PaginationItem>
            <PaginationNext href={buildHref(page + 1, category)} />
          </PaginationItem>
        ) : null}
      </PaginationContent>
    </Pagination>
  );
}
