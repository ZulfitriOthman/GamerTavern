import cornerBouquet from '../assets/florals/corner-bouquet.svg'
import CoupleNames from './CoupleNames'
import Divider from './Divider'
import FloatingPetals from './FloatingPetals'
import GoldCrest from './GoldCrest'
import './InvitationCover.css'

function CoverPanel({ side }) {
  return (
    <div className={`cover__panel cover__panel--${side}`} aria-hidden="true">
      <img className="cover__corner cover__corner--top" src={cornerBouquet} alt="" />
      <img
        className="cover__corner cover__corner--bottom"
        src={cornerBouquet}
        alt=""
      />
    </div>
  )
}

function InvitationCover({
  title,
  couple,
  date,
  venue,
  buttonLabel,
  opening,
  onOpen,
}) {
  return (
    <div className={`cover${opening ? ' is-opening' : ''}`} inert={opening}>
      <CoverPanel side="left" />
      <CoverPanel side="right" />

      <div className="cover__content">
        <div className="cover__inner">
          <GoldCrest className="cover__crest" />
          <p className="cover__title">{title}</p>
          <Divider />
          <CoupleNames couple={couple} className="cover__names" />
          <p className="cover__event">
            <span>{date}</span>
            <span className="cover__event-dot" aria-hidden="true" />
            <span>{venue}</span>
          </p>
          <button type="button" className="cover__button" onClick={onOpen}>
            {buttonLabel}
          </button>
        </div>
      </div>

      {opening && <FloatingPetals variant="burst" />}
    </div>
  )
}

export default InvitationCover
