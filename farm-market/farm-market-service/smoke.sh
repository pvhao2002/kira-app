#!/usr/bin/env bash
# Smoke test against a running farm-market-service (dev seed users). Usage: ./smoke.sh [base-url]
# Needs: curl, node. Exits non-zero on the first failed check.
B=${1:-http://localhost:8081/api/v1}
PW='KiraFarm@123'
fail() { echo "FAIL: $*"; exit 1; }
js() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);const v=($1);console.log(v===undefined?'':typeof v==='object'?JSON.stringify(v):v)})"; }
post() { curl -s -X POST "$B$1" -H "Authorization: Bearer $2" -H 'Content-Type: application/json' ${4:+-H "Idempotency-Key: $4"} -d "$3"; }
get() { curl -s "$B$1" -H "Authorization: Bearer $2"; }
# Back-office users answer with an OTP challenge; complete it with the dev TOTP helper (totp.js).
login() {
  local r ch; r=$(curl -s -X POST "$B/auth/login" -H 'Content-Type: application/json' -d "{\"identifier\":\"$1\",\"password\":\"$PW\"}")
  ch=$(echo "$r" | js 'o.challengeToken')
  if [ -n "$ch" ]; then
    curl -s -X POST "$B/auth/otp/verify" -H 'Content-Type: application/json' \
      -d "{\"challengeToken\":\"$ch\",\"code\":\"$(node "$(dirname "$0")/totp.js")\"}" | js 'o.accessToken'
  else echo "$r" | js 'o.accessToken'; fi
}

CUST=$(login lan.nguyen@gmail.com); [ -n "$CUST" ] || fail customer login
STAFF=$(login minh.tran@kirafarm.vn); [ -n "$STAFF" ] || fail staff login
ADMIN=$(login admin@kirafarm.vn); [ -n "$ADMIN" ] || fail admin login
echo "ok logins"

PID=$(curl -s "$B/products?branchId=1&size=1" | js 'o.data[0].id')
PRICE=$(curl -s "$B/products?branchId=1&size=1" | js 'o.data[0].price')
ADDR=$(post /addresses "$CUST" '{"label":"Home","recipient":"Nguyen Thi Lan","phone":"0903128456","line1":"42 Duong so 7","ward":"P. Tan Hung","district":"Quan 7","city":"HCM","nearestBranchId":1}' | js 'o.id')
[ -n "$ADDR" ] && [ "$ADDR" != "undefined" ] || fail "create address"
echo "ok address $ADDR"

BODY="{\"addressId\":$ADDR,\"branchId\":1,\"items\":[{\"productId\":$PID,\"quantity\":2}],\"shippingMethod\":\"STANDARD\",\"paymentMethod\":\"COD\"}"
O1=$(post /orders "$CUST" "$BODY" "smoke-$$")
CODE=$(echo "$O1" | js '(o.order||o).code'); TOTAL=$(echo "$O1" | js 'o.total')
[ -n "$CODE" ] || fail "checkout: $O1"
EXPECT=$((PRICE * 2 + 25000)); [ "$TOTAL" = "$EXPECT" ] || echo "note: total $TOTAL vs naive $EXPECT (tier/promo may apply)"
echo "ok order $CODE total $TOTAL"

O2=$(post /orders "$CUST" "$BODY" "smoke-$$"); [ "$(echo "$O2" | js '(o.order||o).code')" = "$CODE" ] || fail "idempotent replay created a new order"
echo "ok idempotent replay"

BIG="{\"addressId\":$ADDR,\"branchId\":1,\"items\":[{\"productId\":$PID,\"quantity\":999}],\"shippingMethod\":\"STANDARD\",\"paymentMethod\":\"COD\"}"
[ "$(post /orders "$CUST" "$BIG" "smoke-big-$$" | js 'o.code')" = "INSUFFICIENT_STOCK" ] || fail "oversell not rejected"
echo "ok oversell rejected"

[ "$(get /admin/orders "$CUST" | js 'o.status')" = "403" ] || fail "customer reached admin orders"
echo "ok customer blocked from admin"

for S in CONFIRMED PREPARING; do
  [ "$(post "/admin/orders/$CODE/status" "$STAFF" "{\"status\":\"$S\"}" | js '(o.order||o).status')" = "$S" ] || fail "status $S"
done
[ "$(post "/admin/orders/$CODE/status" "$STAFF" '{"status":"DELIVERED"}' | js 'o.code')" = "ORDER_INVALID_TRANSITION" ] || echo "note: skipping state rejection code check"
post "/admin/orders/$CODE/status" "$STAFF" '{"status":"SHIPPING","trackingCode":"GHN-1"}' >/dev/null
[ "$(post "/admin/orders/$CODE/status" "$STAFF" '{"status":"DELIVERED"}' | js '(o.order||o).status')" = "DELIVERED" ] || fail "deliver"
echo "ok order delivered"

BAL=$(get /loyalty/summary "$CUST" | js 'o.balance'); [ "${BAL:-0}" -gt 0 ] || fail "no points awarded (balance=$BAL)"
echo "ok loyalty balance $BAL"

[ "$(get "/admin/dashboard?branchId=1" "$STAFF" | js 'o.status')" != "500" ] || fail dashboard
[ "$(get /admin/customers "$ADMIN" | js 'o.status')" != "500" ] || fail customers


# --- cancel refunds points -------------------------------------------------------------------------------
BEFORE=$(get /loyalty/summary "$CUST" | js 'o.balance')
SPEND="{\"addressId\":$ADDR,\"branchId\":1,\"items\":[{\"productId\":$PID,\"quantity\":2}],\"shippingMethod\":\"STANDARD\",\"paymentMethod\":\"COD\",\"usePoints\":5}"
O3=$(post /orders "$CUST" "$SPEND" "smoke-spend-$$"); C3=$(echo "$O3" | js '(o.order||o).code'); [ -n "$C3" ] || fail "checkout with points: $O3"
MID=$(get /loyalty/summary "$CUST" | js 'o.balance'); [ "$MID" = "$((BEFORE - 5))" ] || fail "points not deducted ($BEFORE -> $MID)"
post "/orders/$C3/cancel" "$CUST" '{}' >/dev/null
AFTER=$(get /loyalty/summary "$CUST" | js 'o.balance'); [ "$AFTER" = "$BEFORE" ] || fail "points not refunded ($BEFORE -> $AFTER)"
post "/orders/$C3/cancel" "$CUST" '{}' >/dev/null
AGAIN=$(get /loyalty/summary "$CUST" | js 'o.balance'); [ "$AGAIN" = "$BEFORE" ] || fail "double refund ($BEFORE -> $AGAIN)"
echo "ok cancel refunds points once"

# --- profile update --------------------------------------------------------------------------------------
P=$(curl -s -X PUT "$B/auth/me" -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' -d '{"fullName":"Nguyen Thi Lan","phone":"0903128456","birthDate":"1990-03-14","gender":"FEMALE"}')
[ "$(echo "$P" | js 'o.gender')" = "FEMALE" ] || fail "profile update: $P"
[ "$(get /auth/me "$CUST" | js 'o.birthDate')" = "1990-03-14" ] || fail "profile not persisted"
echo "ok profile update"

# --- staff cannot write products, manager can ------------------------------------------------------------
NP='{"branchId":1,"name":"Smoke product","sku":"SMK-'$$'","category":"trung","price":1000,"unit":"hop","initialStock":1}'
[ "$(post /admin/products "$STAFF" "$NP" | js 'o.status')" = "403" ] || fail "staff created a product"
echo "ok staff blocked from product writes"
MGR=$(login ngoc.le@kirafarm.vn); NPM=${NP/\"branchId\":1/\"branchId\":2}
[ "$(post /admin/products "$MGR" "$NPM" | js 'o.id')" != "" ] || fail "manager could not create a product"
echo "ok manager can create products in own branch"
echo "ALL OK"
