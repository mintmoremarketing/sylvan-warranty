// Reference numbers contain slashes (WRN/26/000124); URLs use dashes (WRN-26-000124).

export const toSlug = (ref: string) => ref.replaceAll("/", "-")
export const fromSlug = (slug: string) => decodeURIComponent(slug).replaceAll("-", "/")
