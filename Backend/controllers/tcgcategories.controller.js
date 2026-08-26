const toStr = (v) => (v == null ? "" : String(v)).trim();

const ROLES = {
	USER: "USER",
	VENDOR: "VENDOR",
	ADMIN: "ADMIN",
};

function normalizeRole(role) {
	const r = String(role || ROLES.USER).toUpperCase();
	return Object.values(ROLES).includes(r) ? r : ROLES.USER;
}

function canSell(role) {
	return role === ROLES.VENDOR || role === ROLES.ADMIN;
}

const QUERY_PLANS = [
	{
		sql: "SELECT ID AS id, TCG_CATEGORIES AS name FROM CATEGORIES_TCG ORDER BY ID",
		table: "CATEGORIES_TCG",
	},
	{
		sql: "SELECT ID AS id, NAME AS name FROM CATEGORIES_TCG ORDER BY ID",
		table: "CATEGORIES_TCG",
	},
	{
		sql: "SELECT ID AS id, NAME AS name FROM CATEGORIES ORDER BY ID",
		table: "CATEGORIES",
	},
];

const INSERT_PLANS = [
	{
		sql: "INSERT INTO CATEGORIES_TCG (ID, TCG_CATEGORIES) VALUES (?, ?)",
	},
	{
		sql: "INSERT INTO CATEGORIES_TCG (ID, NAME) VALUES (?, ?)",
	},
	{
		sql: "INSERT INTO CATEGORIES (ID, NAME) VALUES (?, ?)",
	},
];

function normalizeRows(rows = []) {
	return rows
		.map((row) => {
			const id = toStr(row?.id ?? row?.ID);
			const name = toStr(row?.name ?? row?.NAME ?? row?.tcg_categories ?? row?.TCG_CATEGORIES);
			if (!id && !name) return null;
			return {
				id: id || name,
				name: name || id,
			};
		})
		.filter(Boolean);
}

function isRetryableSchemaError(err) {
	const code = err?.code;
	return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR";
}

async function loadCategories(db) {
	let lastErr;

	for (const plan of QUERY_PLANS) {
		try {
			const [rows] = await db.query(plan.sql);
			return normalizeRows(rows || []);
		} catch (err) {
			lastErr = err;
			if (!isRetryableSchemaError(err)) break;
		}
	}

	throw lastErr || new Error("Unable to load TCG categories.");
}

async function insertCategory(db, id, name) {
	let lastErr;

	for (const plan of INSERT_PLANS) {
		try {
			await db.execute(plan.sql, [id, name]);
			return;
		} catch (err) {
			lastErr = err;
			if (!isRetryableSchemaError(err)) break;
		}
	}

	throw lastErr || new Error("Unable to create TCG category.");
}

async function resolveRoleFromDb(db, userId) {
	const id = Number(userId);
	if (!Number.isFinite(id) || id <= 0) return ROLES.USER;

	try {
		const [rows] = await db.query(
			"SELECT ROLE FROM PERSONAL_USER WHERE ID = ? LIMIT 1",
			[id],
		);
		return normalizeRole(rows?.[0]?.ROLE);
	} catch (err) {
		console.error("[tcgcategories.controller] role lookup failed:", err?.message || err);
		return ROLES.USER;
	}
}

export default function tcgCategoriesSocketController({ socket, io, db }) {
	socket.on("tcgcategories:list", async (_payload, ack) => {
		try {
			const data = await loadCategories(db);
			if (typeof ack === "function") ack({ success: true, data });
			socket.emit("tcgcategories:list", data);
		} catch (err) {
			console.error("[tcgcategories.controller] tcgcategories:list error:", err?.message || err);
			if (typeof ack === "function") {
				ack({ success: false, data: [], message: err?.message || "Failed to load TCG categories." });
			}
			socket.emit("tcgcategories:list", []);
		}
	});

	socket.on("tcgcategories:create", async (payload = {}, ack) => {
		// Identity from the verified handshake, never the client-supplied payload.
		const actorId = socket.user ? Number(socket.user.id) : NaN;
		const role = await resolveRoleFromDb(db, actorId);

		if (!canSell(role)) {
			if (typeof ack === "function") {
				ack({ success: false, message: "Only vendors/admin can create TCG categories." });
			}
			return;
		}

		const id = toStr(payload?.id);
		const name = toStr(payload?.name);

		if (!id || !name) {
			if (typeof ack === "function") {
				ack({ success: false, message: "id and name are required." });
			}
			return;
		}

		try {
			await insertCategory(db, id, name);
			const data = await loadCategories(db);

			if (typeof ack === "function") {
				ack({ success: true, data, message: "TCG category created." });
			}

			io.emit("tcgcategories:updated", data);
		} catch (err) {
			const duplicate = err?.code === "ER_DUP_ENTRY";
			if (typeof ack === "function") {
				ack({
					success: false,
					message: duplicate ? "Category ID already exists." : err?.message || "Failed to create TCG category.",
				});
			}
		}
	});
}
