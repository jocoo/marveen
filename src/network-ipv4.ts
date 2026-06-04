// Force IPv4-first DNS + disable Happy Eyeballs for all outbound fetch() calls.
//
// WSL2 typically advertises a host AAAA record for api.telegram.org but has no
// usable IPv6 route. Node's Happy Eyeballs (net.connectMultiple) races the v4
// and v6 attempts; when v6 errors out with ENETUNREACH it cancels the v4 race
// and the call surfaces as AggregateError [ETIMEDOUT] -- even though `curl -4`
// to the same v4 host returns in ~1s. Telegram/Slack/Discord token validation
// and any outbound channel send then fails with `fetch failed`.
//
// Resolving v4 first AND turning off the simultaneous-family selection makes
// fetch() try v4 first and fall back to v6 only if v4 fails, sidestepping the
// WSL2 race without taking on an undici dependency.
import dns from 'node:dns'
import net from 'node:net'

dns.setDefaultResultOrder('ipv4first')
net.setDefaultAutoSelectFamily(false)
