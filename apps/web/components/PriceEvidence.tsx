import {t,type Locale} from "@chhal/i18n";
import type {PriceTrace} from "@/lib/api";
export function PriceEvidence({locale,price}:{locale:Locale;price:PriceTrace}){
 let url:string|null=null;try{const u=new URL(price.sourceUrl??"");if(u.protocol==="https:"&&!u.username&&!u.password)url=u.href;}catch{}
 return <span className="price-evidence">
 {price.validUntil&&<span>{t(locale,price.validityStatus==="estimee"?"v1.estimatedUntil":"v1.validUntil",{date:price.validUntil})}</span>}
 {price.observedAt&&<span>{t(locale,"v1.collectedOn",{date:new Date(price.observedAt).toLocaleDateString(locale==="ar"?"ar-MA":locale)})}</span>}
 {url&&<a href={url} target="_blank" rel="noopener noreferrer">{t(locale,"v1.viewSource")}</a>}
 </span>;
}
