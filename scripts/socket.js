import { SOCKET_NAME } from "./constants.js";
import { loc } from "./util.js";

/**
 * Canal pedido/resposta sobre game.socket.
 *
 * Jogadores não podem alterar o mistério (JournalEntry do mestre), então o resultado
 * de cada teste vai para o mestre ativo, que valida, aplica e responde. O mestre
 * processa um pedido por vez, para duas pessoas não coletarem a mesma pista juntas.
 */
export class InvSocket {
  static #pending = new Map();
  static #handlers = new Map();
  static #queue = Promise.resolve();
  static TIMEOUT_MS = 30000;

  static init() {
    game.socket.on(SOCKET_NAME, (msg) => this.#onMessage(msg));
  }

  /** Registra uma operação executada no cliente do mestre: async (payload, user) => resultado. */
  static register(op, handler) {
    this.#handlers.set(op, handler);
  }

  static async request(op, payload) {
    const gm = game.users.activeGM;
    if (!gm) throw new Error(loc("CPRINV.Error.NoGM"));
    if (gm.isSelf) return this.#run(op, payload, game.user);

    const requestId = foundry.utils.randomID(16);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new Error(loc("CPRINV.Error.Timeout")));
      }, this.TIMEOUT_MS);
      this.#pending.set(requestId, { resolve, reject, timer });
      game.socket.emit(SOCKET_NAME, {
        kind: "request",
        requestId,
        op,
        payload,
        userId: game.user.id,
        gmId: gm.id,
      });
    });
  }

  static #run(op, payload, user) {
    const handler = this.#handlers.get(op);
    if (!handler) return Promise.reject(new Error(`Unknown operation: ${op}`));
    const job = this.#queue.then(() => handler(payload, user));
    this.#queue = job.catch(() => null);
    return job;
  }

  static async #onMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.kind === "request") {
      if (msg.gmId !== game.user.id) return;
      const user = game.users.get(msg.userId);
      let reply;
      try {
        if (!user) throw new Error("Unknown user");
        const result = await this.#run(msg.op, msg.payload, user);
        reply = { kind: "response", requestId: msg.requestId, userId: msg.userId, ok: true, result };
      } catch (err) {
        console.error(err);
        reply = { kind: "response", requestId: msg.requestId, userId: msg.userId, ok: false, error: err.message };
      }
      game.socket.emit(SOCKET_NAME, reply);
      return;
    }
    if (msg.kind === "response") {
      if (msg.userId !== game.user.id) return;
      const pending = this.#pending.get(msg.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.#pending.delete(msg.requestId);
      if (msg.ok) pending.resolve(msg.result);
      else pending.reject(new Error(msg.error));
    }
  }
}
