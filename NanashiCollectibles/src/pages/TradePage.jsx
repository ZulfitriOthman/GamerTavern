import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSocket, connectSocket } from "../socket/socketClient";

function TradePage() {
  const [currentUser, setCurrentUser] = useState(null);

  const [query, setQuery] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newTrade, setNewTrade] = useState({
    title: "",
    game: "mtg",
    condition: "Near Mint",
    type: "trade",
    want: "",
    notes: "",
  });

  /* -----------------------------------------------------------
     INIT USER + SOCKET
  ----------------------------------------------------------- */
  useEffect(() => {
    const raw = localStorage.getItem("tavern_current_user");
    const user = raw ? JSON.parse(raw) : null;
    setCurrentUser(user);

    connectSocket(user?.name || "guest");
  }, []);

  /* -----------------------------------------------------------
     LOAD TRADES
  ----------------------------------------------------------- */
  const loadTrades = () => {
    const s = getSocket();
    if (!s?.connected) return;

    setLoading(true);
    s.emit(
      "trade:list",
      {
        game: gameFilter,
        type: typeFilter,
        search: query,
      },
      (res) => {
        setLoading(false);
        if (!res?.success) {
          setServerError(res?.message || "Failed to load trades.");
          return;
        }
        setListings(res.data || []);
      }
    );
  };

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onConnect = () => loadTrades();
    const onCreated = (l) => setListings((p) => [l, ...p]);
    const onDeleted = ({ id }) =>
      setListings((p) => p.filter((x) => x.id !== id));

    s.on("connect", onConnect);
    s.on("trade:created", onCreated);
    s.on("trade:deleted", onDeleted);

    if (s.connected) loadTrades();

    return () => {
      s.off("connect", onConnect);
      s.off("trade:created", onCreated);
      s.off("trade:deleted", onDeleted);
    };
    // eslint-disable-next-line
  }, [gameFilter, typeFilter]);

  /* -----------------------------------------------------------
     CREATE TRADE
  ----------------------------------------------------------- */
  const submitTrade = (e) => {
    e.preventDefault();
    if (!currentUser?.id) {
      setServerError("You must be logged in.");
      return;
    }

    const s = getSocket();

    s.emit(
      "trade:create",
      {
        currentUser,
        ...newTrade,
      },
      (res) => {
        if (!res?.success) {
          setServerError(res?.message || "Failed to create trade.");
          return;
        }

        setShowCreate(false);
        setNewTrade({
          title: "",
          game: "mtg",
          condition: "Near Mint",
          type: "trade",
          want: "",
          notes: "",
        });
      }
    );
  };

  const deleteTrade = (id) => {
    const s = getSocket();
    s.emit("trade:delete", { currentUser, id });
  };

  /* -----------------------------------------------------------
     FILTER CLIENT SIDE
  ----------------------------------------------------------- */
  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();

    return listings.filter((item) => {
      const conditionOk =
        conditionFilter === "all"
          ? true
          : item.condition === conditionFilter;

      const qOk = !q
        ? true
        : [item.title, item.want, item.notes]
            .join(" ")
            .toLowerCase()
            .includes(q);

      return conditionOk && qOk;
    });
  }, [listings, query, conditionFilter]);

  const conditionOptions = useMemo(() => {
    const set = new Set(listings.map((x) => x.condition).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [listings]);

  /* -----------------------------------------------------------
     UI
  ----------------------------------------------------------- */
  return (
    <div className="relative space-y-6">

      {serverError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">
          {serverError}
        </div>
      )}

      {/* CREATE TRADE BUTTON */}
      <div className="flex justify-between items-center">
        <h2 className="font-serif text-2xl text-amber-100 font-bold">
          Trade Hub
        </h2>

        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl border border-amber-500/50 bg-amber-950/40 px-4 py-2 text-xs uppercase tracking-wide text-amber-100 hover:border-amber-400"
        >
          + Make Trade
        </button>
      </div>

      {/* CREATE FORM */}
      {showCreate && (
        <form
          onSubmit={submitTrade}
          className="rounded-2xl border border-amber-800/40 bg-slate-950/50 p-4 space-y-3"
        >
          <input
            value={newTrade.title}
            onChange={(e) =>
              setNewTrade((p) => ({ ...p, title: e.target.value }))
            }
            placeholder="Listing title"
            className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 text-amber-50"
          />

          <div className="grid sm:grid-cols-3 gap-2">
            <select
              value={newTrade.game}
              onChange={(e) =>
                setNewTrade((p) => ({ ...p, game: e.target.value }))
              }
              className="rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 text-amber-50"
            >
              <option value="mtg">Magic</option>
              <option value="ygo">Yu-Gi-Oh</option>
              <option value="pokémon">Pokémon</option>
              <option value="vanguard">Vanguard</option>
            </select>

            <select
              value={newTrade.condition}
              onChange={(e) =>
                setNewTrade((p) => ({ ...p, condition: e.target.value }))
              }
              className="rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 text-amber-50"
            >
              <option>Near Mint</option>
              <option>Lightly Played</option>
              <option>Moderately Played</option>
            </select>

            <select
              value={newTrade.type}
              onChange={(e) =>
                setNewTrade((p) => ({ ...p, type: e.target.value }))
              }
              className="rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 text-amber-50"
            >
              <option value="trade">For Trade</option>
              <option value="sale">For Sale</option>
            </select>
          </div>

          <textarea
            value={newTrade.want}
            onChange={(e) =>
              setNewTrade((p) => ({ ...p, want: e.target.value }))
            }
            placeholder="What do you want?"
            className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 text-amber-50"
          />

          <textarea
            value={newTrade.notes}
            onChange={(e) =>
              setNewTrade((p) => ({ ...p, notes: e.target.value }))
            }
            placeholder="Notes"
            className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 text-amber-50"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-xs text-amber-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg border border-amber-500/50 px-4 py-2 text-xs text-amber-100"
            >
              Create Listing
            </button>
          </div>
        </form>
      )}

      {/* LISTINGS */}
      {loading ? (
        <p className="text-amber-200 text-sm">Loading...</p>
      ) : filteredListings.length === 0 ? (
        <p className="text-amber-200/70 text-sm">
          No listings found.
        </p>
      ) : (
        filteredListings.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-amber-900/40 bg-slate-950/60 p-4"
          >
            <div className="flex justify-between">
              <div>
                <h4 className="text-amber-50 font-semibold">
                  {item.title}
                </h4>
                <p className="text-xs text-amber-200/70">
                  {item.game} • {item.condition}
                </p>
              </div>

              {currentUser?.id === item.user_id && (
                <button
                  onClick={() => deleteTrade(item.id)}
                  className="text-xs text-rose-400"
                >
                  Delete
                </button>
              )}
            </div>

            <div className="mt-2 text-xs text-amber-200">
              <p>
                <strong>Wants:</strong> {item.want}
              </p>
              <p>
                <strong>Notes:</strong> {item.notes}
              </p>
            </div>
          </article>
        ))
      )}

      <div className="flex justify-end">
        <Link to="/" className="text-xs text-amber-300">
          ← Back to Shop
        </Link>
      </div>
    </div>
  );
}

export default TradePage;
