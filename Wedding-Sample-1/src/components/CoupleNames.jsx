// The couple's full names, each on its own line, joined by a script "Dengan".
function CoupleNames({ couple, className = '' }) {
  return (
    <p className={`couple ${className}`}>
      <span className="couple__name">{couple.first}</span>
      <span className="couple__joiner">{couple.joiner}</span>
      <span className="couple__name">{couple.second}</span>
    </p>
  )
}

export default CoupleNames
