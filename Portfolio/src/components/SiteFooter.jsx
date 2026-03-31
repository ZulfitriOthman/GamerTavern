function SiteFooter({ year }) {
  return (
    <footer className="w-full px-6 pb-4 pt-4 text-slate-400 md:px-10">
      <div className="mx-auto flex max-w-5xl justify-center px-6 py-4 md:px-8">
        <p className="text-center">© {year} Recce Ops. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default SiteFooter;
