import type { FC, PropsWithChildren } from "hono/jsx";

export const Layout: FC<
  PropsWithChildren<{
    sidebar?: ReturnType<FC>;
  }>
> = ({ children, sidebar }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta content="width=device-width, initial-scale=1.0" name="viewport" />
        <title>Project Dashboard</title>
        <link href="/styles.css" rel="stylesheet" />
      </head>
      <body class="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div class="flex min-h-screen">
          {sidebar}
          <main class="flex-1 overflow-auto">
            <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
        <script src="/htmx.min.js">{""}</script>
        <script src="/main.js">{""}</script>
      </body>
    </html>
  );
};
