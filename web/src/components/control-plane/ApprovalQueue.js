"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ApprovalQueue;
var react_1 = require("react");
var supabase_queries_1 = require("../../lib/supabase-queries");
var useAuth_1 = require("../../hooks/useAuth");
function ApprovalQueue() {
    var user = (0, useAuth_1.useAuth)().user;
    var _a = (0, react_1.useState)([]), approvals = _a[0], setApprovals = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(null), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)({}), rejectionReasons = _d[0], setRejectionReasons = _d[1];
    var _e = (0, react_1.useState)(null), actioning = _e[0], setActioning = _e[1];
    (0, react_1.useEffect)(function () {
        loadApprovals();
        var subscription = (0, supabase_queries_1.subscribeToApprovalUpdates)(function (newApproval) {
            setApprovals(function (prev) { return __spreadArray([newApproval], prev, true); });
        });
        return function () {
            subscription.unsubscribe();
        };
    }, []);
    function loadApprovals() {
        return __awaiter(this, void 0, void 0, function () {
            var data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, 3, 4]);
                        setLoading(true);
                        return [4 /*yield*/, (0, supabase_queries_1.getPendingApprovals)()];
                    case 1:
                        data = _a.sent();
                        setApprovals(data);
                        return [3 /*break*/, 4];
                    case 2:
                        err_1 = _a.sent();
                        setError(err_1 instanceof Error ? err_1.message : 'Failed to load approvals');
                        return [3 /*break*/, 4];
                    case 3:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function handleApprove(id) {
        return __awaiter(this, void 0, void 0, function () {
            var err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(user === null || user === void 0 ? void 0 : user.id))
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        setActioning(id);
                        return [4 /*yield*/, (0, supabase_queries_1.approveOperation)(id, user.id)];
                    case 2:
                        _a.sent();
                        setApprovals(function (prev) { return prev.filter(function (a) { return a.id !== id; }); });
                        return [3 /*break*/, 5];
                    case 3:
                        err_2 = _a.sent();
                        setError(err_2 instanceof Error ? err_2.message : 'Failed to approve');
                        return [3 /*break*/, 5];
                    case 4:
                        setActioning(null);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    function handleReject(id) {
        return __awaiter(this, void 0, void 0, function () {
            var reason, err_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(user === null || user === void 0 ? void 0 : user.id))
                            return [2 /*return*/];
                        reason = rejectionReasons[id] || 'No reason provided';
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        setActioning(id);
                        return [4 /*yield*/, (0, supabase_queries_1.rejectOperation)(id, reason, user.id)];
                    case 2:
                        _a.sent();
                        setApprovals(function (prev) { return prev.filter(function (a) { return a.id !== id; }); });
                        setRejectionReasons(function (prev) {
                            var _a;
                            return (__assign(__assign({}, prev), (_a = {}, _a[id] = '', _a)));
                        });
                        return [3 /*break*/, 5];
                    case 3:
                        err_3 = _a.sent();
                        setError(err_3 instanceof Error ? err_3.message : 'Failed to reject');
                        return [3 /*break*/, 5];
                    case 4:
                        setActioning(null);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    if (loading)
        return React.createElement("div", { className: "text-center py-8" }, "Loading approvals...");
    var pendingCount = approvals.length;
    var totalCostNeeded = approvals.reduce(function (sum, a) { return sum + a.estimated_cost; }, 0);
    return (React.createElement("div", { className: "space-y-6" },
        React.createElement("div", { className: "bg-gray-600 rounded p-4" },
            React.createElement("div", { className: "grid grid-cols-2 gap-4" },
                React.createElement("div", null,
                    React.createElement("div", { className: "text-gray-400 text-sm" }, "Pending Approvals"),
                    React.createElement("div", { className: "text-3xl font-bold text-yellow-400" }, pendingCount)),
                React.createElement("div", null,
                    React.createElement("div", { className: "text-gray-400 text-sm" }, "Total Cost Blocked"),
                    React.createElement("div", { className: "text-3xl font-bold text-red-400" },
                        "$",
                        totalCostNeeded.toFixed(2))))),
        error && React.createElement("div", { className: "bg-red-900 text-red-100 rounded p-4" }, error),
        pendingCount === 0 ? (React.createElement("div", { className: "text-center py-12 text-gray-400" },
            React.createElement("div", { className: "text-2xl mb-2" }, "\u2713 All Clear"),
            React.createElement("div", null, "No pending approvals. All operations approved!"))) : (React.createElement("div", { className: "space-y-4" }, approvals.map(function (approval) { return (React.createElement("div", { key: approval.id, className: "bg-gray-700 rounded p-4 border-l-4 border-yellow-500" },
            React.createElement("div", { className: "flex justify-between items-start mb-3" },
                React.createElement("div", { className: "flex-1" },
                    React.createElement("div", { className: "font-semibold text-lg" }, approval.operation_type),
                    React.createElement("div", { className: "text-sm text-gray-400 mt-1" },
                        "ID: ",
                        approval.operation_id),
                    React.createElement("div", { className: "text-sm text-gray-400" },
                        "Reason: ",
                        approval.reason),
                    React.createElement("div", { className: "text-sm text-yellow-400 font-semibold mt-2" },
                        "Cost: $",
                        approval.estimated_cost.toFixed(2))),
                React.createElement("div", { className: "text-right text-sm text-gray-400" }, new Date(approval.created_at).toLocaleString())),
            actioning !== approval.id && (React.createElement("div", { className: "mb-3" },
                React.createElement("input", { type: "text", placeholder: "Rejection reason (optional)", value: rejectionReasons[approval.id] || '', onChange: function (e) {
                        return setRejectionReasons(function (prev) {
                            var _a;
                            return (__assign(__assign({}, prev), (_a = {}, _a[approval.id] = e.target.value, _a)));
                        });
                    }, className: "w-full bg-gray-600 text-white rounded px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500" }))),
            React.createElement("div", { className: "flex gap-2" },
                React.createElement("button", { onClick: function () { return handleApprove(approval.id); }, disabled: actioning !== null, className: "flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded py-2 font-semibold transition" }, actioning === approval.id ? '...' : '✓ Approve'),
                React.createElement("button", { onClick: function () { return handleReject(approval.id); }, disabled: actioning !== null, className: "flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded py-2 font-semibold transition" }, actioning === approval.id ? '...' : '✗ Reject')))); })))));
}
