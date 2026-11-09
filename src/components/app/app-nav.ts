// Пункти навігації спільного макета (AC-DSYS-02): однакові на кожній сторінці для того, хто увійшов.
export const APP_NAV = [
  { href: "/templates", label: "Templates" },
  { href: "/runs", label: "Runs" },
  { href: "/runs/new", label: "Launch a template" },
];

// Вендор бачить лише запуски (AC-VENDOR-08).
export const VENDOR_NAV = [{ href: "/runs", label: "Runs" }];
