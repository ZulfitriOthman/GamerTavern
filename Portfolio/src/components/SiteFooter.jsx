function SiteFooter({ year }) {
  return (
    <footer className="w-full px-4 pb-10 text-slate-400 md:px-10">
      <div className="mx-auto flex w-full justify-center">
        <p className="w-full text-center">© {year} Recce Ops. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default SiteFooter;
