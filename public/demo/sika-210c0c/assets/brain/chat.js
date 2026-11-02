// chat.js: the talking layer. Social turns (hello, thanks, bye, who are you), vague asks (a place or a bare product group) that get ONE clarifying question with tap options,
// the follow-up that joins that question ("bathroom" then "under tiles"), and the "My pick" lead on a recommend ask. Deterministic templates: no model, no network.
// Every product fact still comes from the advisor and quotes its published sentence; nothing here states a product fact of its own.
import { normalise } from './text.js';
import { applySlang } from './match.js';
import * as C from './cards.js';
import { fact } from './schema.js';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const STARTERS = [
  { label: 'Waterproof a bathroom', q: 'Waterproofing for a shower floor under tiles' },
  { label: 'Tile a floor', q: 'Tile adhesive for porcelain tiles on a concrete floor' },
  { label: 'Seal around a shower', q: 'Silicone sealant for a shower' },
  { label: 'Fix a crack', q: 'Repair cracks in a concrete floor' },
];
const JOB_LINE = 'Tell me what you are working on, like the surface and the problem, and I will find the Sika products whose data sheets cover it.';
const CHAT_CHIP = 'A chat reply, not a product claim';
const ASK_CHIP = 'A question to find the right data sheet';
const starterCard = (title, headline) => { const c = C.chooseCard(title, headline, STARTERS.map((s) => s.q), [], STARTERS.map((s) => s.label)); c.followups = STARTERS.map((s) => s.q); c.chip = CHAT_CHIP; return c; };

// ---- social turns -------------------------------------------------------------------------------------------------------------------------------------------------
const TAIL = '(?: (?:mate|there|team|sika|all|everyone|bud|buddy|man|legend|champ|guys|folks|friend|bro|again|please|pls))*';
const GREET = '(?:hi|hello|hey|heya|hiya|yo|howdy|g day|gday|good (?:morning|afternoon|evening|day)|morning|arvo|evening|hey hey|hi there|hello there)';
const HOW = '(?:how are (?:you|ya|u)(?: going| doing| today| going today)?|how s it going|hows it going|how you going|how r u|how s your day|hows your day|you good|you ok|you okay|are you well|how have you been)';
const SOC = [
  ['frustrated', /\b(useless|rubbish|crap|crappy|garbage|stupid|dumb|hopeless|terrible|awful|shit|shite|bullshit|sucks?|pathetic|worthless|idiot|unhelpful|trash|junk|lame)\b|\b(not|no|isn t|aren t|never) (very |that |at all )?(helpful|help)\b|\bnot what i (asked|meant|wanted|said)\b|\byou (don t|do not|dont|didn t|can t|cant) (understand|get it|listen|help)\b|\b(that s|thats|you re|youre|you are|this is) (wrong|not right|no good|no help)\b|\bwrong answer\b|\bwhy (?:can t|won t|don t|wont|cant) you\b|\bwhy (?:are|r) you (?:so |being )?(?:useless|slow|dumb|stupid|unhelpful)\b|\bjust answer(?: me)?\b/, 9],
  ['bye', new RegExp(`^(?:(?:ok|okay|right|all good|no worries|thanks|thank you|cheers|ta|great|perfect|awesome) )*(?:bye|bye bye|goodbye|good bye|see (?:you|ya)(?: later| soon| round| around)?|cya|seeya|later|laters|catch you later|talk later|ttyl|good night|goodnight|night|have a (?:good|great|nice) (?:one|day|weekend|arvo|afternoon|night)|that s all|thats all|that is all|that s it|thats it|nothing else|i m done|im done|all done)(?: (?:mate|for now|thanks|thank you|cheers|then|all|team|buddy|bro|man|ta|now))*$`), 8],
  ['thanks', new RegExp(`^(?:(?:ok|okay|right|oh|ah|wow|nice|good|great|awesome|perfect|brilliant|excellent|sweet|beaut|beauty|legend|ripper|top|cool|fantastic|lovely|wonderful) )*(?:thanks|thank you|thankyou|thx|thnx|ta|cheers|(?:you re|you are|your|youre) (?:a |an )?(?:legend|star|champ|champion|lifesaver|ripper|top bloke|good bot|great|awesome|beauty)|many thanks|much appreciated|appreciate it|i appreciate it|nice one|good on you|good one|great|awesome|perfect|brilliant|excellent|sweet|beaut|beauty|legend|ripper|top|fantastic|lovely|wonderful|that s great|thats great|that helps|that s helpful|thats helpful|helpful|got it|makes sense|understood|i see)(?: (?:thanks|thank you|cheers|ta|mate|so much|a lot|heaps|very much|for (?:that|your help|the help|the info|the advice)|that s (?:great|helpful)|again|team|buddy|man|bro|legend))*$`), 9],
  ['who', new RegExp(`^${'(?:' + GREET + ' )?'}(?:who are you|who is this|who am i (?:talking|speaking|chatting) to|what are you|what s your name|whats your name|what is your name|your name|are you (?:a )?(?:real|human|person|bot|robot|ai|chatbot|computer|machine)|are you real|is this a (?:bot|real person|person|robot|chatbot)|is anyone there|are you there|anyone there|you there|u there|who made you|who built you|who s this|whos this|who am i talking to)${TAIL}$`), 12],
  ['cando', /^(?:(?:hi|hello|hey|so|ok|okay) )?(?:what can you (?:do|help (?:me )?with)|what do you do|what can i ask(?: you)?|what do you know|how can you help(?: me)?|how do you work|how does (?:this|it) work|what are you for|what is this|what s this|whats this|what is this for|what can u (?:do|help (?:me )?with)|what do u do|what questions can i ask|what are you good for|what are your skills|what is this thing|what is this site|what is this place|can you do|what do you offer)(?: mate| there| exactly)?$/, 10],
  ['help', new RegExp(`^(?:${GREET}${TAIL} )?(?:(?:can|could|will|would) (?:you|u) (?:please )?help(?: me)?(?: out)?|(?:i )?(?:need|want) (?:some |a bit of |a )?(?:help|hand|advice)(?: with (?:a |the |my |this |our |some )?(?:renovation|reno|job|project|work|something|stuff|bathroom|kitchen))?|help(?: me| please| mate)?(?: with (?:a |the |my |this |our |some )?(?:renovation|reno|job|project|work|something|stuff))?|got a (?:question|minute|sec)|have a question|i have a question|(?:can|could) i ask (?:you )?(?:a |something|a question)?|question|quick question|i ve got a question|ive got a question|got a quick question|can i ask a question|are you able to help|are you able to help me|mind helping|you able to help)${TAIL}$`), 12],
  ['how', new RegExp(`^(?:${GREET}${TAIL} )?${HOW}${TAIL}$`), 12],
  ['greet', new RegExp(`^${GREET}${TAIL}(?: ${GREET}${TAIL})?$`), 6],
  ['yes', /^(?:(?:lol|lmao|haha+|hehe+|heh|ha) )?(?:lol|lmao|haha+|hehe+|heh|ha|yes|yep|yeah|yup|ya|yea|sure|alright|all right|ok|okay|k|kk|right|cool|fine|sounds good|go on|please|yes please|why not|of course|definitely|correct|true|mhm|mm|hmm|hm|um|uh|oh|ah|aha|good|go ahead|do it)(?: (?:please|then|mate|thanks))?$/, 4],
  ['no', /^(?:no|nope|nah|no thanks|no thank you|not really|not sure|dunno|i don t know|idk|maybe|nothing|never mind|nevermind|forget it|not yet|na)(?: (?:thanks|mate|really|right now))?$/, 5],
];
const UNSURE_RX = /\b(?:no (?:clue|idea)|(?:i )?(?:have|got) no (?:clue|idea)|not (?:too |really |entirely |that |100 )?(?:sure|certain|clear|positive)|unsure|dunno|(?:don t|do not|dont|cant|can t|couldn t) (?:know|say|tell|decide|work it out)|hard to say|undecided|still deciding|no preference)\b/g;
const UNSURE_FILL = new Set('i we me my a an the to be at this that it its is for what about of on in so just bit too quite really honestly sorry honest yet atm tbh stage point moment still totally entirely percent 100 mate there and but really actually well um hm yeah nah no'.split(' '));
/** the kind of social turn a message is ('greet', 'how', 'thanks', 'bye', 'who', 'cando', 'help', 'frustrated', 'yes', 'no'), or '' */
export function socialKind(n0) {
  const n = chatNorm(clean(applySlang(normalise(n0)).text || normalise(n0))); if (!n) return '';
  const words = n.split(' ').length;
  for (const [k, rx, max] of SOC) if (words <= max && rx.test(n)) return k;
  // "I do not know" in any wording, with nothing else of substance in it: the same plain reply as a "not sure"
  if (words <= 9 && UNSURE_RX.test(n) && n.replace(UNSURE_RX, ' ').split(' ').filter(Boolean).every((w) => UNSURE_FILL.has(w))) return 'no';
  // a greeting or "you there" in front of a help or how-are-you ask ("arvo mate need a hand with a reno", "hey u there need help"): judge the part after it
  const rest = n.replace(new RegExp(`^(?:(?:${GREET}|are you there|you there|anyone there|is anyone there|you around|how are you|how s it going|how s you|you good)${TAIL}(?: |$))+`), '').replace(/^(?:and |so |um |ok |okay )+/, '').trim();
  if (rest && rest !== n && rest.split(' ').length <= 9) for (const [k, rx, max] of SOC) if (['help', 'cando', 'how', 'who', 'thanks', 'frustrated'].includes(k) && rx.test(rest)) return k;
  return '';
}
// chat-only slang (kept out of slang.js so product questions are read exactly as before): texting shorthand and Aussie chat words
const CHAT_SLANG = [[/\bu\b/g, 'you'], [/\bur\b/g, 'your'], [/\bthx\b|\bthnx\b|\bthanx\b|\btks\b|\btnx\b/g, 'thanks'], [/\bsumthin\w*|\bsumthing\b|\bsomthin\w*|\bsomethin\b|\bsomting\b/g, 'something'], [/\bgoin\b|\bgoing\b(?= (?:today|on))/g, 'going'], [/\bhows\b/g, 'how s'], [/\bwat\b|\bwot\b|\bwht\b/g, 'what'],
  [/\bpls\b|\bplz\b|\bplse\b|\bpleez\b/g, 'please'], [/\bappreciate ya\b|\bta heaps\b|\bta very much\b|\bcheers heaps\b|\bcheers ta\b/g, 'thanks'], [/\breno\b|\brenos\b/g, 'renovation'], [/\bheya+\b|\bhiya+\b|\bheyy+\b|\bhii+\b|\bhellooo+\b/g, 'hi'], [/\bcant\b/g, 'can t'], [/\bdont\b/g, 'don t'], [/\bwont\b/g, 'won t'], [/\bidk\b/g, 'dunno'],
  [/\bany1\b/g, 'anyone'], [/\bsum1\b/g, 'someone'], [/\bnoob\b/g, 'new']];
const chatNorm = (t) => { let x = ' ' + t + ' '; for (const [rx, to] of CHAT_SLANG) x = x.replace(rx, ` ${to} `); return x.replace(/\s+/g, ' ').trim(); };
const hello = (n) => (/\bgood (morning|afternoon|evening)\b/.exec(n) || [])[0];
/** the reply to a social turn: one or two short sentences and starter chips. Never a "not in the documentation" card. */
export function socialCard(kind, n0) {
  const n = normalise(n0); const g = hello(n);
  const T = {
    greet: [g ? g.charAt(0).toUpperCase() + g.slice(1) : 'G\'day', `${g ? 'Good to have you here.' : 'Good to have you here.'} ${JOB_LINE}`],
    how: ['All good here, thanks', `Good of you to ask. ${JOB_LINE}`],
    thanks: ['No worries', 'Happy to help. If there is another job or a product you want to check, just tell me the surface and the problem.'],
    bye: ['See you later', 'Thanks for stopping by. If a job comes up, I am here whenever you want a hand finding the right Sika product.'],
    who: ['I am the Sika product assistant', 'I read the Sika Australia product pages and data sheets and point you to the products that match your job. I quote the sheet for every claim, and for anything it does not say I send you to Sika Technical Services.'],
    cando: ['Here is what I can do', 'Tell me the job and I will find the Sika products whose data sheets cover it, give the coverage and cure times from the sheets, work out how much you need for an area, and link the safety data sheet. I do not do prices or stock.'],
    help: ['Yes, happy to help', JOB_LINE],
    frustrated: ['Fair enough, let me try again', 'Sorry I missed it. Tell me the surface, what is going wrong, and where it is (inside, outside, wet area), and I will look for the products whose data sheets cover it.'],
    yes: ['Good', JOB_LINE],
    no: ['No worries', 'If anything comes up, tell me the surface and the problem and I will look it up.'],
  }[kind];
  return starterCard(T[0], T[1]);
}

// ---- vague asks: a place or a bare product group ----------------------------------------------------------------------------------------------------------------
// opts are full questions the assistant already answers from the data (each is run by the test suite and must not come back "not published"). kw = words that pick this option from a typed follow-up.
const O = (label, q, kw) => ({ label, q, kw: kw.split(' ') });
const WP = O('Waterproofing', 'Waterproofing for a shower floor under tiles', 'waterproof waterproofing membrane under beneath below leak leaky leaking leaks wet damp moisture tank tanking');
const TA = O('Tile adhesive', 'Tile adhesive for porcelain tiles on a bathroom wall', 'adhesive glue gluing stick sticking bond bonding lay laying fix fixing porcelain tiles tile tiling wall mortar');
const GR = O('Grout', 'Grout for a shower floor', 'grout grouting regrout between lines');
const SE = O('Sealant', 'Silicone sealant for a shower', 'seal sealing sealant silicone silicon caulk caulking sealer around gap gaps edge edges bath basin sink mould mouldy corner corners');
const FL = O('Fix a leak', 'Best waterproofing membrane for a leaking shower', 'leak leaky leaking leaks drip dripping');
export const PLACES = [
  { id: 'bathroom', key: 'bathroom bathrooms ensuite shower showers bath bathtub toilet wetroom', title: 'Bathroom', text: 'Which part of the bathroom is the job?',
    opts: [O('Waterproof under tiles', WP.q, WP.kw.join(' ') + ' tiles tile floor'), O('Tile adhesive', TA.q, TA.kw.join(' ')), O('Grout', GR.q, GR.kw.join(' ')), O('Sealant around the bath', SE.q, SE.kw.join(' '))] },
  { id: 'kitchen', key: 'kitchen kitchens splashback splashbacks benchtop', title: 'Kitchen', text: 'Which part of the kitchen?',
    opts: [O('Splashback tiles', 'Tile adhesive for a kitchen splashback', 'splashback tile tiles tiling adhesive glue stick wall'), O('Bench sealant', 'Silicone sealant for a kitchen bench', 'seal sealant silicone bench benchtop sink gap gaps around caulk'), O('Grout', 'Grout for a kitchen floor', 'grout grouting floor between'), O('Uneven floor', 'Levelling compound for an uneven kitchen floor', 'level levelling leveller uneven floor screed')] },
  { id: 'laundry', key: 'laundry laundries', title: 'Laundry', text: 'Which part of the laundry?',
    opts: [O('Waterproofing', 'Waterproofing for a laundry floor under tiles', WP.kw.join(' ')), O('Tile adhesive', 'Tile adhesive for laundry floor tiles', TA.kw.join(' ')), O('Tub sealant', 'Silicone sealant for a laundry tub', SE.kw.join(' ') + ' tub trough')] },
  { id: 'balcony', key: 'balcony balconies terrace patio veranda verandah', title: 'Balcony', text: 'Which part of the balcony?',
    opts: [O('Waterproofing', 'Waterproofing for a balcony under tiles', WP.kw.join(' ')), O('Tile adhesive', 'Tile adhesive for an outdoor balcony', TA.kw.join(' ')), O('Sealant', 'Sealant for outdoor joints', 'seal sealant silicone joint joints gap gaps caulk around'), O('Fix a leak', 'Waterproofing for a leaking balcony', 'leak leaking leaks drip dripping')] },
  { id: 'roof', key: 'roof roofs rooftop roofing', title: 'Roof', text: 'What is the roof job?',
    opts: [O('Liquid membrane', 'Liquid applied waterproofing membrane for a roof', 'liquid membrane waterproof waterproofing coat coating paint on leak leaking leaks'), O('Torch on', 'Torch on membrane for a flat roof', 'torch sheet bitumen flat'), O('Gutter', 'Sealant for a leaking gutter', 'gutter gutters seal sealant downpipe'), O('PVC sheet', 'PVC roofing sheet', 'pvc sheet single ply')] },
  { id: 'garage', key: 'garage garages shed workshop warehouse carport', title: 'Garage or workshop floor', text: 'What does the floor need?',
    opts: [O('Coating', 'Epoxy floor coating for a garage', 'epoxy coating coat paint seal sealed dust finish'), O('Levelling', 'Self levelling compound for an uneven garage floor', 'level levelling leveller uneven screed'), O('Repair', 'Repair mortar for a damaged concrete floor', 'repair damaged broken holes pitted spalling patch mortar crumbling'), O('Joints', 'Joint filler for a slab', 'joint joints filler gap gaps cracks crack')] },
  { id: 'pool', key: 'pool pools spa', title: 'Pool', text: 'Which part of the pool?',
    opts: [O('Tile adhesive', 'Tile adhesive for a swimming pool surround', TA.kw.join(' ') + ' surround'), O('Waterproofing', 'Waterproofing for a swimming pool before tiling', WP.kw.join(' ')), O('Sealant', 'Silicone for a swimming pool', SE.kw.join(' ')), O('Grout', 'Grout for a swimming pool', GR.kw.join(' '))] },
  { id: 'deck', key: 'deck decks decking', title: 'Deck', text: 'What is the deck job?',
    opts: [O('Fixing', 'Adhesive for fixing decking', 'fix fixing adhesive glue stick screw fasten'), O('Waterproofing', 'Waterproofing for a deck under tiles', WP.kw.join(' ')), O('Joints', 'Sealant for deck joints', 'seal sealant joint joints gap gaps'), O('Tiling', 'Tile adhesive for an outdoor balcony', 'tile tiles tiling porcelain ceramic')] },
  { id: 'basement', key: 'basement basements cellar', title: 'Basement', text: 'What is the basement job?',
    opts: [O('Waterproofing', 'Waterproofing for a basement', 'waterproof waterproofing membrane damp wet moisture tank tanking'), O('Fix a leak', 'Fast setting mortar to plug a leak', 'leak leaking leaks plug seep seeping water'), O('Cracks', 'Injection resin for leaking cracks', 'crack cracks injection inject resin')] },
  { id: 'floor', key: 'floor floors', title: 'Floor', text: 'What is wrong with the floor?',
    opts: [O('Uneven', 'Self levelling compound for an uneven concrete floor', 'uneven level levelling leveller screed bumpy dip dips slope'), O('Damaged', 'Repair mortar for a damaged concrete floor', 'damaged repair broken holes pitted crumbling patch'), O('Coating', 'Epoxy coating for a concrete floor', 'epoxy coating coat paint seal dust finish'), O('Tiling', 'Tile adhesive for a floor', 'tile tiles tiling adhesive glue lay laying')] },
  { id: 'wall', key: 'wall walls', title: 'Wall', text: 'What is the wall job?',
    opts: [O('Tiling', 'Tile adhesive for walls in a wet area on plasterboard', 'tile tiles tiling adhesive glue stick'), O('Waterproofing', 'Waterproofing for a wet area wall', WP.kw.join(' ')), O('Repair', 'Repair mortar for a damaged concrete wall', 'repair damaged broken holes crack cracks patch crumbling'), O('Cracks', 'Injection resin for leaking cracks', 'crack cracks injection inject resin')] },
  { id: 'concrete', key: 'concrete slab slabs', title: 'Concrete', text: 'What is the concrete job?',
    opts: [O('Repair', 'Repair mortar for spalling concrete', 'repair damaged spalling broken holes patch crumbling'), O('Levelling', 'Self levelling compound for an uneven slab', 'level levelling leveller uneven screed'), O('New pour', 'Admixture for a concrete pour', 'new pour admixture mix additive plasticiser'), O('Waterproofing', 'Waterproofing for a concrete slab', WP.kw.join(' '))] },
  { id: 'outside', key: 'outside outdoors outdoor exterior external', title: 'Outdoors', text: 'What is the outdoor job?',
    opts: [O('Tiling', 'Tile adhesive for an outdoor balcony', TA.kw.join(' ')), O('Waterproofing', 'Waterproofing for a balcony under tiles', WP.kw.join(' ')), O('Sealing joints', 'Sealant for outdoor joints', 'seal sealant joint joints gap gaps caulk')] },
  { id: 'timber', key: 'timber wood wooden', title: 'Timber', text: 'What is the timber job?',
    opts: [O('Timber floor', 'Adhesive for timber flooring', 'floor flooring floorboards parquet'), O('Decking', 'Adhesive for fixing decking', 'deck decking'), O('Skirting and trim', 'Construction adhesive for fixing skirting boards', 'skirting trim board boards architrave panel panels'), O('Joints', 'Sealant for timber joints', 'seal sealant joint joints gap gaps')] },
  { id: 'window', key: 'window windows door doors', title: 'Windows and doors', text: 'What is the job around the window or door?',
    opts: [O('Seal the frame', 'Sealant for a window frame', 'seal sealant frame silicone gap gaps around caulk'), O('Fix a leak', 'Sealant for a leaking window', 'leak leaking leaks drip water'), O('Glue', 'Adhesive for fixing a door frame', 'glue adhesive stick fix fixing bond')] },
  { id: 'sealant', cat: true, key: 'sealant sealants sealer silicone silicon caulk caulking', title: 'Sealant', text: 'What is the sealant for?',
    opts: [O('Shower or bath', 'Silicone sealant for a shower', SE.kw.join(' ') + ' shower wet bathroom'), O('Facade joints', 'Sealant for expansion joints in a facade', 'facade joint joints expansion movement building wall'), O('Gutter', 'Sealant for a leaking gutter', 'gutter gutters roof downpipe'), O('Fire rated', 'Fire rated sealant for service penetrations', 'fire rated penetration penetrations service pipe')] },
  { id: 'glue', cat: true, key: 'adhesive adhesives glue glues gluing stick sticking', title: 'Adhesive', text: 'What are you sticking?',
    opts: [O('Tiles', 'Tile adhesive for porcelain tiles on a concrete floor', 'tile tiles tiling porcelain ceramic floor'), O('Skirting and trim', 'Construction adhesive for fixing skirting boards', 'skirting trim timber wood board boards architrave panel panels'), O('Timber floor', 'Adhesive for timber flooring', 'timber floor flooring wood parquet'), O('Laminate', 'Contact adhesive for laminate', 'laminate bench benchtop contact')] },
  { id: 'waterproofing', cat: true, key: 'waterproofing waterproof waterproofer membrane membranes tanking', title: 'Waterproofing', text: 'Where is the waterproofing going?',
    opts: [O('Shower, under tiles', 'Waterproofing for a shower floor under tiles', 'shower bathroom ensuite wet tiles tile'), O('Basement', 'Waterproofing for a basement', 'basement cellar below underground retaining'), O('Roof', 'Waterproofing for a roof', 'roof flat gutter'), O('Balcony', 'Waterproofing for a balcony under tiles', 'balcony terrace patio deck outdoor outside external')] },
  { id: 'grout', cat: true, key: 'grout grouts grouting', title: 'Grout', text: 'Where is the grout going?',
    opts: [O('Shower', 'Grout for a shower floor', 'shower bathroom wet floor'), O('Commercial kitchen', 'Epoxy grout for a commercial kitchen', 'commercial kitchen epoxy chemical'), O('Pool', 'Grout for a swimming pool', 'pool swimming'), O('Wide joints', 'Grout for wide joints', 'wide large big joint joints')] },
  { id: 'tileadh', cat: true, key: '', noun: 'tile adhesive', title: 'Tile adhesive', text: 'What are you tiling?',
    opts: [O('Floor tiles', 'Tile adhesive for porcelain tiles on a concrete floor', 'floor porcelain ceramic concrete'), O('Bathroom wall', 'Tile adhesive for porcelain tiles on a bathroom wall', 'wall bathroom shower wet'), O('Outdoor', 'Tile adhesive for an outdoor balcony', 'outdoor outside balcony external exterior patio'), O('Large format', 'Tile adhesive for large format tiles', 'large format big heavy slab')] },
  { id: 'tiles', cat: true, key: 'tile tiles tiling', title: 'Tiling', text: 'What do you need for the tiling?',
    opts: [O('Adhesive', 'Tile adhesive for porcelain tiles on a concrete floor', 'adhesive glue stick lay laying fix fixing'), O('Waterproofing', 'Waterproofing for a shower floor under tiles', WP.kw.join(' ')), O('Grout', 'Grout for a shower floor', GR.kw.join(' ')), O('Primer', 'Primer for tiling over smooth concrete', 'primer prime priming prep prepare smooth')] },
  { id: 'primer', cat: true, key: 'primer primers priming', title: 'Primer', text: 'What is it priming?',
    opts: [O('Before tiling', 'Primer for tiling over smooth concrete', 'tile tiles tiling smooth concrete'), O('Before levelling', 'Primer for a levelling compound on concrete', 'level levelling leveller screed floor'), O('Before sealant', 'Primer before sealant on porous surfaces', 'sealant seal silicone porous joint')] },
  { id: 'repair', cat: true, key: 'repair repairs repairing patching patch', title: 'Repairs', text: 'What is being repaired?',
    opts: [O('Concrete damage', 'Repair mortar for spalling concrete', 'concrete spalling damaged broken holes crumbling mortar'), O('Cracks', 'Fill cracks in a wall before painting', 'crack cracks cracked'), O('Floor', 'Repair mortar for a damaged concrete floor', 'floor')] },
  { id: 'leveller', cat: true, key: 'screed leveller leveler levelling leveling', title: 'Screed or leveller', text: 'What is the floor job?',
    opts: [O('Uneven concrete', 'Self levelling compound for an uneven concrete floor', 'uneven concrete bumpy dip slab'), O('Under tiles', 'Self levelling compound under tiles', 'tile tiles tiling under'), O('Thick layer', 'Levelling compound for a thick layer', 'thick deep layer')] },
  { id: 'leak', key: 'leak leaks leaking leaky', title: 'Leaks', text: 'Where is the leak?',
    opts: [O('Shower', FL.q, 'shower bathroom bath ensuite'), O('Roof', 'Waterproofing for a leaking roof', 'roof gutter ceiling'), O('Concrete wall', 'Fast setting mortar to plug a leak', 'wall basement concrete plug'), O('Cracks', 'Injection resin for leaking cracks', 'crack cracks')] },
  { id: 'crack', key: 'crack cracks cracked', title: 'Cracks', text: 'What is cracked?',
    opts: [O('Concrete floor', 'Repair cracks in a concrete floor', 'floor slab concrete'), O('Wall', 'Injection resin for leaking cracks', 'wall leaking leak water'), O('Render', 'Repair mortar for a cracked render', 'render plaster stucco')] },
  { id: 'gutter', key: 'gutter gutters guttering downpipe downpipes', title: 'Gutter', text: 'What is the gutter job?',
    opts: [O('Fix a leak', 'Sealant for a leaking gutter', 'leak leaking leaks drip dripping seal sealant fix'), O('Seal the joints', 'Sealant for gutter seams and joins', 'joint joints join seam seams gap gaps sealant seal silicone'), O('Line the gutter', 'Liquid applied waterproofing membrane for a roof', 'line lining membrane waterproof waterproofing coat coating liquid')] },
  { id: 'driveway', key: 'driveway driveways footpath footpaths path paths pavement carpark', title: 'Driveway or path', text: 'What is the job on the driveway or path?',
    opts: [O('Cracks', 'Repair cracks in a concrete floor', 'crack cracks cracked'), O('Damaged concrete', 'Repair mortar for spalling concrete', 'repair damaged broken holes spalling crumbling pitted patch mortar'), O('Joints', 'Joint filler for a slab', 'joint joints filler gap gaps'), O('Coating', 'Epoxy coating for a concrete floor', 'coating coat paint seal sealed dust epoxy finish')] },
  { id: 'fence', key: 'fence fences fencing post posts gate gates', title: 'Fence', text: 'What is the fence job?',
    opts: [O('Set a post', 'Chemical anchor for fixing a fence post into concrete', 'post posts anchor set fix fixing bolt concrete'), O('Glue timber', 'Adhesive for timber posts', 'timber wood glue adhesive stick bond'), O('Seal joints', 'Sealant for outdoor joints', 'seal sealant joint joints gap gaps')] },
  { id: 'stairs', key: 'stairs stair steps step staircase', title: 'Stairs', text: 'What is the job on the stairs?',
    opts: [O('Repair chips', 'Repair mortar for spalling concrete', 'repair chipped chip damaged broken crumbling spalling patch mortar crack cracked'), O('Tile the steps', 'Tile adhesive for outdoor steps', 'tile tiles tiling adhesive glue'), O('Non slip', 'Non slip coating for concrete steps', 'slip slippery non coating coat grip anti epoxy')] },
  { id: 'pergola', key: 'pergola pergolas gazebo gazebos awning', title: 'Pergola', text: 'What is the pergola job?',
    opts: [O('Fix timber', 'Adhesive for timber posts', 'timber wood glue adhesive stick bond beam beams'), O('Fix a post', 'Anchor fixing for a post', 'post posts anchor bolt concrete footing set'), O('Seal joints', 'Sealant for timber joints', 'seal sealant joint joints gap gaps')] },
  { id: 'skylight', key: 'skylight skylights', title: 'Skylight', text: 'What is the skylight job?',
    opts: [O('Fix a leak', 'Sealant for a leaking window', 'leak leaking leaks drip dripping water'), O('Seal the frame', 'Sealant for a window frame', 'seal sealant frame silicone gap gaps around caulk'), O('Roof around it', 'Liquid applied waterproofing membrane for a roof', 'roof flashing membrane waterproof waterproofing coat')] },
  { id: 'tank', key: 'tank tanks', title: 'Water tank', text: 'What is the water tank job?',
    opts: [O('Waterproof it', 'Waterproofing for a concrete water tank', 'waterproof waterproofing membrane line lining inside coat'), O('Stop a leak', 'Fast setting mortar to plug a leak', 'leak leaking leaks plug seep seeping'), O('Cracks', 'Injection resin for leaking cracks', 'crack cracks cracked')] },
];
// phrase list: every key (single word or a multi word phrase listed in PHRASES) -> place
const PHRASES = {
  bathroom: ['shower recess', 'wet area', 'wet areas', 'wet room', 'en suite'], roof: ['flat roof', 'metal roof', 'tin roof', 'iron roof', 'colorbond roof', 'tile roof', 'roof sheeting', 'roof sheets'], outside: ['outdoor area', 'outdoor areas', 'outside area', 'outside areas', 'backyard', 'back yard', 'yard', 'garden'], tank: ['water tank', 'water tanks', 'rain tank', 'rainwater tank'], driveway: ['concrete driveway', 'concrete path'], garage: ['garage floor', 'shed floor', 'workshop floor', 'warehouse floor'], pool: ['swimming pool'],
  basement: ['retaining wall'], window: ['window frame', 'door frame'], tileadh: ['tile adhesive', 'tile glue', 'tile adhesives', 'tiling adhesive', 'adhesive for tiles'], repair: ['concrete repair', 'repair mortar'],
  leveller: ['levelling compound', 'self levelling', 'self levelling compound'], leak: ['water leak'],
};
const WORDKEYS = new Map(); // single word -> place id
for (const p of PLACES) for (const w of p.key.split(' ')) if (w && !WORDKEYS.has(w)) WORDKEYS.set(w, p.id);
WORDKEYS.set('tile', 'tiles'); WORDKEYS.set('tiles', 'tiles'); WORDKEYS.set('tiling', 'tiles'); WORDKEYS.set('suite', 'bathroom');

const FILLER = new Set(('hi hello hey heya hiya yo g day gday mate bud buddy man legend please pls thanks thank ok okay so just really actually and also now well um umm hmm yeah yep mm ' +
  'can could would will do does did you u ya i me my our we the a an some any something sumthing somthing anything stuff things thing need needs needed want wants wanna looking look lookin for after to on in at with about of is are was it s im i m ive ' +
  'what whats which who how whos where recommend recommended recommendation recommendations suggest suggestions suggestion advice advise reckon think thoughts opinion best better good great right ideal top ' +
  'should shall would use using buy get got have has ideas idea know tell show give pick choose one ones product products item items option options job jobs work project reno renovation renovations renovating renovate redo redoing doing do building build help helping hand ' +
  'something someting new old little bit quick question dont don t dunno idk').split(' '));
const VAGUEV = new Set('fixing renovating renovate redoing doing building redo repairing work working tiling waterproofing sealing'.split(' '));
const REC_WORD = /^(?:rec+o?m+e?n+d\w*|rec+o?m+\w*|sug+e?st\w*|reckon|best|better|ideal|advice|advise|ideas?)$/;
const lev = (a, b) => { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; let prev = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; };
const KEYWORDS = [...WORDKEYS.keys()].filter((w) => w.length >= 5);
const fixTypo = (w) => { if (WORDKEYS.has(w) || FILLER.has(w) || w.length < 5) return w; let best = w, bd = 9; for (const k of KEYWORDS) { if (k[0] !== w[0]) continue; const d = lev(w, k); const lim = w.length >= 6 ? 2 : 1; if (d <= lim && d < bd) { bd = d; best = k; } } return best; };
const plural = (w) => (w.length > 4 && w.endsWith('s') && WORDKEYS.has(w.slice(0, -1)) ? w.slice(0, -1) : w);
/** { place, rec } when the message is only a place or a bare product group wrapped in chat ("what do you recommend for my bathroom", "can u recommend a sealent"); place null with rec for "what do you recommend" */
export function placeOf(n0) {
  const n = chatNorm(clean(applySlang(normalise(n0)).text || normalise(n0))).replace(new RegExp(`^(?:(?:${GREET}|${HOW}|are you there|you there)${TAIL}(?: |$))+`), '').trim(); const words = n.split(' ').filter(Boolean);
  if (!words.length || words.length > 12) return null;
  let rec = false; const rest = [];
  for (let w of words) { if (REC_WORD.test(w)) { rec = true; continue; } if (/^(use|pick|choose|good|great)$/.test(w) && words.includes('what')) rec = rec || false; w = fixTypo(w); if (FILLER.has(w) && !WORDKEYS.has(w)) { continue; } rest.push(plural(w)); }
  if (!rest.length) return { place: null, rec };
  // multi word phrases first
  const joined = rest.join(' '); let hit = null;
  for (const [id, phs] of Object.entries(PHRASES)) for (const ph of phs) if (joined === ph || joined === ph + ' reno') hit = id;
  if (!hit) {
    const known = rest.filter((w) => WORDKEYS.has(w)); const ids = [...new Set(known.map((w) => WORDKEYS.get(w)))]; const others = rest.filter((w) => !WORDKEYS.has(w) && !VAGUEV.has(w) && !/^(floor|wall)$/.test(w));
    if (ids.length === 1 && !others.length) { const r = known.length >= 2 ? resolveOpt(PLACES.find((x) => x.id === ids[0]), known) : null; if (r) return { place: PLACES.find((x) => x.id === ids[0]), rec, ask: r.q }; hit = ids[0]; }
    else if (ids.length === 1 && others.length) return null;
    else if (ids.length === 2 && !others.length) {
      const [x, y] = ids; const kitchenish = ['garage', 'kitchen', 'bathroom', 'pool'].find((k) => ids.includes(k));
      if (kitchenish && ['floor', 'wall', 'concrete'].includes(x === kitchenish ? y : x)) hit = kitchenish;
      else { const px = PLACES.find((p) => p.id === x), py = PLACES.find((p) => p.id === y); const wx = known.filter((w) => WORDKEYS.get(w) === x), wy = known.filter((w) => WORDKEYS.get(w) === y);
        const order = (px.cat && !py.cat) ? [[py, wx], [px, wy]] : (!px.cat && py.cat) ? [[px, wy], [py, wx]] : [[py, wx], [px, wy]];
        if (ids.includes('tiles') && ['bathroom', 'kitchen', 'laundry'].some((k) => ids.includes(k))) return { place: PLACES.find((p) => p.id === ids.find((k) => k !== 'tiles')), rec };
        for (const [pl, ws] of order) { if (pl.cat || pl.id === 'tiles' || pl.id === 'crack') continue; const r = resolveOpt(pl, ws); if (r) return { place: pl, rec, ask: r.q }; }
        const base = order.find(([pl]) => !pl.cat && pl.id !== 'tiles' && pl.id !== 'crack'); const cat = order.find(([pl]) => pl.cat || pl.id === 'tiles');
        if (base && cat) return { place: base[0], rec }; return null; }
    }
  }
  if (!hit) return null;
  return { place: PLACES.find((p) => p.id === hit), rec };
}
const resolveOpt = (p, ws) => { const toks = new Set(ws.map((w) => stemw(w))); const sc = p.opts.map((o) => ({ o, s: o.kw.filter((k) => toks.has(stemw(k))).length })).sort((a, b) => b.s - a.s); return sc[0].s >= 1 && (sc.length < 2 || sc[0].s > sc[1].s) ? sc[0].o : null; };
export function placeCard(pl, rec) {
  const p = pl;
  const c = C.chooseCard(p.title, `${p.text} Tap one, or tell me in your own words.`, p.opts.map((o) => o.q), [], p.opts.map((o) => o.label));
  c.followups = p.opts.map((o) => o.q); c.chip = ASK_CHIP;
  return { card: c, convo: { id: p.id, rec: !!rec } };
}
export function genericCard(rec) {
  const c = starterCard(rec ? 'Happy to recommend something' : 'What are you working on?', rec ? 'I need the job first, so I pick from the right data sheets. Tap one, or tell me the surface and the problem.' : 'Tell me the surface and the problem, or tap the nearest job.'); c.chip = ASK_CHIP;
  return { card: c, convo: { id: 'generic', rec: !!rec } };
}

// ---- the follow-up that joins a clarifying question ("bathroom" then "under tiles") -------------------------------------------------------------------------------
// places that describe a surface, position or product group rather than a room: said after a clarifier they narrow the job, they do not change it
const MODIFIER = new Set(['floor', 'wall', 'outside', 'tiles', 'timber', 'concrete', 'leak', 'crack']);
const QWORD = /^(what|whats|how|why|who|where|when|which|can|could|is|are|does|do|will|would|tell|show|give)\b/;
function stemw(w) { return w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w; }
const GENERIC_OPTS = STARTERS.map((s, i) => O(s.label, s.q, ['waterproof waterproofing membrane leak leaking bathroom shower wet', 'tile tiles tiling floor adhesive glue', 'seal sealant silicone caulk around bath shower gap', 'crack cracks cracked concrete repair'][i]));
/** a place that narrows a job (a surface, position or product group) rather than naming a new room */
export const isModifier = (pl) => !!pl && (MODIFIER.has(pl.id) || !!pl.cat);
/** The job we were last asking about (a few turns ago, already answered) plus a lone narrowing word ("sealant", "which silicone", "what adhesive"): the option of that job the words pick, or null when the words pick none. */
export function joinPlace(n0, placeId) {
  const pl = PLACES.find((p) => p.id === placeId); if (!pl) return null;
  const n = clean(applySlang(normalise(n0)).text || normalise(n0)); const toks = new Set(n.split(' ').filter(Boolean).map((w) => stemw(fixTypo(w === 'sealer' ? 'sealant' : w))));
  const scored = pl.opts.map((o) => ({ o, s: o.kw.filter((k) => toks.has(stemw(k))).length })).sort((a, b) => b.s - a.s);
  return scored[0].s >= 1 ? { ask: scored[0].o.q, wantPick: true, picked: true } : null;
}
/** "you pick" after a clarifying question: the first (most common) option of the job we asked about, so the person gets a pick and not the question again */
export function defaultPick(convo) {
  if (!convo) return null;
  const pl = convo.id === 'generic' ? { opts: GENERIC_OPTS } : PLACES.find((p) => p.id === convo.id);
  return pl && pl.opts && pl.opts[0] ? { ask: pl.opts[0].q, wantPick: true, defaulted: true } : null;
}
/** { ask, wantPick, noun } for a short free-text reply to a clarifying question, or null when the message is a fresh question of its own */
export function followUp(n0, convo) {
  if (!convo) return null;
  const n = clean(applySlang(normalise(n0)).text || normalise(n0)); const words = n.split(' ').filter(Boolean);
  if (!words.length || words.length > 8 || (QWORD.test(n) && !/^(what|how) about\b/.test(n))) return null;
  const pl = convo.id === 'generic' ? { opts: GENERIC_OPTS, id: 'generic' } : PLACES.find((p) => p.id === convo.id); if (!pl) return null;
  const exact = pl.opts.find((o) => normalise(o.q) === n); if (exact) return { ask: exact.q, wantPick: convo.rec, exact: true };
  const toks = new Set(words.map((w) => stemw(fixTypo(w))));
  const scored = pl.opts.map((o) => ({ o, s: o.kw.filter((k) => toks.has(stemw(k))).length })).sort((a, b) => b.s - a.s);
  const np = placeOf(n0);
  // a different room or site ("kitchen" after "bathroom") is a fresh question; a MODIFIER ("the floor", "outside", "tiles on it", a product group) still belongs to the job we asked about
  if (np && np.place && np.place.id !== pl.id && !(MODIFIER.has(np.place.id) || np.place.cat) && !(scored[0].s >= 1 && (scored.length < 2 || scored[0].s > scored[1].s))) return null;
  if (scored[0].s >= 1 && (scored.length < 2 || scored[0].s > scored[1].s)) return { ask: scored[0].o.q, wantPick: convo.rec, picked: true };
  if (scored[0].s >= 1) return { ask: scored[0].o.q, wantPick: convo.rec, picked: true, tie: true }; // two options fit the words equally: the first listed is the common one, so the person gets an answer, not the same question again
  const noun = convo.id === 'generic' ? '' : (pl.noun || pl.key.split(' ')[0] || pl.title.toLowerCase());
  const body = n.replace(/^(and |also |what about |how about |it s |its |it is |just |a |the )+/, '');
  return { ask: clean(`${body} ${noun}`), wantPick: convo.rec, noun };
}

// ---- the recommendation lead ("My pick ...") ------------------------------------------------------------------------------------------------------------------------
const PICK_BASE = /\b(rec+o?m+e?n+d\w*|sug+e?st\w*|best|better|ideal|which (one )?(is|s|would|should|do)|what (should|do|would|d) (i|you) (use|buy|get|go with|pick|choose)|what (\w+ ){1,3}(should|do|would|can) (i|you|we) (use|buy|get|go with|pick|choose)|which (\w+ ){1,2}(should|would|do) (i|you) (use|buy|get|pick|choose)|what (is|s) good|whats good|good for|any ideas|top pick|what to use|what do i use|what would you use|go with|^(?:which|what) (?!is the |s the |are the |does |do you |can you |is a |is an )(?:[a-z0-9]+ ){0,3}(?:for|on|to use|do i use|should i use|would you use))\b/;
// "what water ratio do I use", "what thickness should we use": a property or how-to ask, not a product pick, unless the asker also says best / recommend / which product
const HOWTO_RX = /\b(ratio|ratios|thickness|temperature|times?|how (much|many|long|thick|deep)|mix(ing)? (ratio|time|amount)|water (ratio|amount|content)|coverage|amount|quantity|dosage|dose|depth|pot life|open time|primer for)\b/;
const PICK_EXPLICIT = /\b(rec+o?m+e?n+d\w*|sug+e?st\w*|best|better|ideal|which (one|product|products)|top pick|go with|what (is|s) good|whats good|good for)\b/;
export const PICK_RX = { test: (n) => PICK_BASE.test(n) && !(HOWTO_RX.test(n) && !PICK_EXPLICIT.test(n)) };
// the shape of a singular ask: one answer wanted ("just one", "your pick", "the go-to", "choose one", "if you had to choose", "single best", "name the one", a trailing "one")
const SINGLE_RX = /\b(?:pick|picks|choose|choice|favou?rite|go to|goto|single|top (?:pick|choice))\b|\b(?:just|only|name|give me|tell me|want|need|take|go with|a|the|which|what)\s+(?:the\s+|a\s+)?one\b|\bone\s+(?:only|please|thanks|pick|choice|product|will do|is fine)\b|\bone\s*$|\bif you had to\b|^one\s+[a-z]+(?:\s+[a-z]+){0,2}\s+(?:for|to|that|under|on)\b/;
const NEED_RX = /\b(need|needs|want|wanna|help|looking for|something (?:to|for)|hunting for|after a|after some)\b/;
const JOB_WORD = /\b(tiles?|tiling|shower|showa|bathroom|laundry|kitchen|balcony|deck|floor|slab|leak|leaky|leaking|leaks|cracked|crack|brick|timber|splashback|roof|gutter|basement)\b/;
/** a recommend ask in any wording: the PICK_RX phrases, plus "need / want / something to" statements after slang and texting shorthand are read ("wat do i use", "sumthin to stick tiles") */
export function wantsPick(n0) {
  const n = chatNorm(clean(applySlang(normalise(n0)).text || normalise(n0))); const raw = normalise(n0);
  return PICK_RX.test(raw) || PICK_RX.test(n) || SINGLE_RX.test(n) || (NEED_RX.test(n) && JOB_WORD.test(n) && !/\b(how (much|many|long)|price|cost|stock|sds|data sheet)\b/.test(n));
}
const CHECK = 'I can only read what Sika has published, so Sika Technical Services should confirm the fit for your site before you buy.';
const docWord = (f) => (f && f.doc_type === 'PDS' ? 'data sheet' : 'product page');
/** Turn an advisor answer (summary card + product cards, ordered by the published criterion) into: one clear pick with its quoted sentence, up to two alternatives, one honesty line.
 *  Two products that tie on the criterion are said to tie, with the one question that would separate them. Anything else (no fit found, a figure ranking, a clarifier) is returned untouched. */
export function withPick(res, q) {
  const cs = res.cards || []; const sum = cs[0];
  if (res.stage !== 'session' && cs.length && ['which', 'tree'].includes(res.intent) && cs[0].type === 'product' && cs[0].product && cs[0].source && cs[0].source.sentence) return productPick(res, cs);
  if (res.stage === 'session' || cs.some((c) => (c.lines || []).some((l) => l.label === 'My pick')) || !sum || sum.type !== 'advice' || sum.status !== 'PUBLISHED' || /ordered by/i.test(sum.title) || cs.length < 2 || cs[1].type !== 'product' || !cs[1].product) return res;
  if (cs[1].noPick) return res; // the only published sentence is a warning, not a use: keep the plain list
  const top = cs[1]; const f = (top.facts && top.facts[0]) || top.source; if (!f || !f.sentence) return res;
  const alts = cs.slice(2).filter((c) => c.type === 'product' && c.product);
  const rk = sum.rank; const tie = !!(rk && rk.length >= 2 && rk[0] != null && rk[0] === rk[1] && alts.length > 0 && (sum.lines || []).some((l) => l.label === 'Assumption'));
  const crit = (sum.lines || []).find((l) => l.label === 'Criterion used'); const env = (sum.lines || []).find((l) => l.label === 'Assumption');
  const lines = []; if (crit) lines.push({ label: 'Criterion used', text: crit.text });
  let headline; let title;
  if (tie && alts.length && env) {
    const nameB = alts[0].product.name; const question = 'Is the job inside or outside?';
    title = `${top.product.name} or ${nameB}`;
    headline = `Two products tie on what the data sheets say: ${top.product.name} and ${nameB}. The sheets cannot separate them for your job (not a claim that one is the best). ${question}`;
    const chips = [`${q} for an internal job`, `${q} for an external job`];
    sum.followups = chips; sum.choices = chips.map((v, i) => ({ label: i ? 'Outside' : 'Inside', value: v }));
    lines.push({ label: top.product.name, text: f.sentence }); if (env) lines.push({ label: 'Assumption', text: env.text });
  } else {
    title = top.product.name;
    headline = `My pick from the data sheets: ${top.product.name}, because its ${docWord(f)} says: "${f.sentence}" (a documented fit, not a claim that one is the best).`;
    if (env) lines.push({ label: 'Assumption', text: env.text });
    if (alts.length) lines.push({ label: alts.length > 1 ? 'Also worth a look' : 'Also worth a look', text: alts.map((c) => c.product.name).join(' and ') });
  }
  lines.push({ label: 'Before you buy', text: CHECK });
  sum.title = title; sum.headline = headline; sum.lines = lines;
  sum.source = tie ? sum.source : fact({ source_url: f.source_url, page: f.page, sentence: f.sentence, doc_type: f.doc_type, doc_version: f.doc_version });
  if (!tie) { sum.facts = [sum.source]; if (!env) sum.followups = [`Data sheet for ${top.product.name}`, `Coverage of ${top.product.name}`, ...(alts[0] ? [`Tell me about ${alts[0].product.name}`] : [])].slice(0, 3); }
  sum.links = [{ label: top.product.name, url: top.product.url }].concat(alts.map((c) => ({ label: c.product.name, url: c.product.url })));
  const rest = tie && alts.length ? cs.slice(1) : cs.slice(2);
  res.cards = [sum, ...rest];
  if (!tie) res.state = { ...(res.state || {}), productIds: [top.product.id, ...alts.map((c) => c.product.id)] }; // the pick lives inside the lead card, so 'the first one' and 'the second one' still count it
  res.followups = sum.followups.slice(); res.trace = (res.trace || []).concat(tie ? ['chat:tie'] : ['chat:pick']);
  return res;
}

/** The same lead for an answer that is already a short list of product cards (the job tree and the index): the first card is the pick, the next two are the alternatives. */
function productPick(res, cs) {
  const top = cs[0]; const f = top.source; const run = cs.findIndex((c) => c.type !== 'product' || !c.product); const prods = run < 0 ? cs : cs.slice(0, run); const alts = prods.slice(1, 3); const tail = cs.slice(prods.length);
  const what = clean(top.headline); const lines = [];
  if (what) lines.push({ label: 'What it is', text: what });
  if (alts.length) lines.push({ label: 'Also worth a look', text: alts.map((c) => c.product.name).join(' and ') });
  lines.push({ label: 'Before you buy', text: CHECK });
  top.headline = `My pick from the data sheets: ${top.product.name}, because its ${docWord(f)} says: "${f.sentence}" (a documented fit, not a claim that one is the best).`;
  top.lines = lines; top.links = (top.links || []).concat(alts.map((c) => ({ label: c.product.name, url: c.product.url }))); top.title = top.product.name;
  res.cards = [top, ...alts, ...tail]; res.trace = (res.trace || []).concat(['chat:pick']);
  return res;
}

// ---- a social turn by shape, when the brain found nothing -------------------------------------------------------------------------------------------------------------
const SELL_ASK = /\b(?:sell|sells|stock|stocks|supply|supplies|make|makes|carry|carries|offer|offers|provide|provides|do|does|have)\b (?:(?:the|any|some|a|an|more|your|much) )*(?!(?:you|u|ya|i|we|it|this|that|they|guys|mate|me|us|there|here|help|hand|chat|time|idea|ideas|question|questions|minute|min|sec|second|moment|anything|something|a|the|to|with|for|about)\b)[a-z]{3,}/;
/** True when the message asks whether Sika sells, stocks or does something (a verb with a thing after it). */
export const sellAsk = (n0) => SELL_ASK.test(chatNorm(clean(applySlang(normalise(n0)).text || normalise(n0))));
/** The social kind of a short message the brain could not place at all (an unknown card with no product and no topic of its own): chat, not a question about the range. '' when it is not chat. */
export function looseSocial(n0, card) {
  const c = card || {}; if (c.type !== 'unknown' || c.product) return '';
  const miss = (c.handoff && c.handoff.missing) || []; if (miss.length && !(miss.length === 1 && /^(instructions|job)$/.test(miss[0]))) return '';
  const n = chatNorm(clean(applySlang(normalise(n0)).text || normalise(n0))); const w = n.split(' ').filter(Boolean);
  if (!w.length || w.length > 12 || /\d/.test(n)) return '';
  // "you guys sell timber?", "do you do carpet", "can you do plumbing": a sell / stock / do ask with something to sell is a question about the range, never chat. It gets the honest "not in the documentation", not "yes, happy to help".
  if (sellAsk(n0)) return '';
  // only a message with a sign that it is addressed to the assistant, or is a greeting, a thanks or a plea for help, is chat; a question with no catalogue words in it ("which is cheaper") keeps the honest no
  if (!/\b(you|your|youre|u|ya|anyone|anybody|someone|team|crew|there|here|hello|hi|hey|yo|morning|arvo|afternoon|evening|help|hand|chat|talk|thanks|thank|cheers|ta|legend|obliged|appreciate|helps|new|first|ok|okay|right|sorry|lol|haha|please|mate|bye|goodbye|later|ciao|ready|free|around|open|this|sure|idea|dunno|unsure|know)\b/.test(n)) return '';
  if (/\b(?:dunno|unsure|no idea|not (?:really )?sure|don t know|do not know|cant say|can t say|cant tell|can t tell)\b/.test(n)) return 'no';
  if (/\b(thanks|thank|cheers|ta|legend|obliged|appreciate|appreciated|helps|helpful|ripper|beauty|sorted|perfect|nice one|top job|great job|good one)\b/.test(n)) return 'thanks';
  if (/\b(bye|goodbye|later|ciao|goodnight)\b/.test(n)) return 'bye';
  if (/\b(bot|robot|human|person|real|machine|chatbot|computer|somebody|anyone|talk to|chat to|who s there)\b/.test(n)) return 'who';
  if (/\b(how (?:do|does|can|would) (?:i|you|this|it|we)|what (?:do|can|sort|kind|else)|use this|ask you|instructions|know about)\b/.test(n)) return 'cando';
  return 'help';
}

// ---- two products side by side -------------------------------------------------------------------------------------------------------------------------------------------
const CMP_LEAD = '(?:(?:and|also|ok|okay|so|now|but|then|what about|how about|tell me|can you tell me|whats|what s|what is|is|are|does|do|how does|how do|how is|how are|can you|could you)\\s+)*';
const SEP = '(?:vs|versus|v|against|compared (?:to|with|against)|compare (?:to|with|against)|stack(?:s|ed)? up (?:against|to|with)|measure(?:s)? up (?:against|to)|differ(?:s|ent)? (?:from|to|than|with)|(?:any |that |much )?different (?:from|to|than)|the same as|same as|better than|or|and)';
/** { a, b } the two sides of a comparing message ("X vs Y", "difference between X and Y", "compare X with Y", "how does X measure up to Y", "X or Y, which is better"), raw text each, or null. A side may be a pronoun. */
export function compareSides(n0) {
  let n = clean(applySlang(normalise(n0)).text || normalise(n0)); if (!n || n.split(' ').length > 22) return null;
  n = n.replace(/\s+(?:which|what) (?:one )?(?:is|s|would be|do you)?\s*(?:the )?(?:better|best|good|safer|stronger|cheaper|easier)?(?: one)?$/, '').replace(/\s+(?:please|thanks)$/, '');
  let m;
  const same = /\b(?:vs|versus|against|compar\w*|differ\w*|difference|stack\w* up|measure\w* up|same as|better than|better)\b/.test(n);
  if ((m = new RegExp(`^${CMP_LEAD}(?:the )?(?:difference|differences|diff) between (.+?) and (.+)$`).exec(n))) return { a: m[1], b: m[2] };
  if ((m = new RegExp(`^${CMP_LEAD}(?:compare|comparing)\\s+(.+?)\\s+(?:with|to|and|against|vs|versus)\\s+(.+)$`).exec(n))) return { a: m[1], b: m[2] };
  if (!same && !/\bor\b/.test(n)) return null;
  const sepRx = new RegExp(`^${CMP_LEAD}(.+?)\\s+${SEP}\\s+(.+)$`);
  if ((m = sepRx.exec(n))) { const sep = /\b(or|and)\b/.exec(n.slice(m[1].length)); if (sep && sep[1] === 'and' && !same) return null; return { a: m[1], b: m[2] }; }
  return null;
}
const PRONOUN = /^(?:it|this|that|this one|that one|the same|them|its|the first|the last|the other)$/;
export const isPronounSide = (s) => PRONOUN.test(String(s || '').trim());
