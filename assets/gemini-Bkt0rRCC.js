import{G as y}from"./genai-B6yI1Dsd.js";const g=new y({apiKey:"PLACEHOLDER_API_KEY"}),f={getAnimeInsight:async(l,h)=>{var o,n,r,t;try{const i=await g.models.generateContent({model:"gemini-3-flash-preview",contents:`Research the anime "${l}" using Google Search.
        Provide a short, exciting "hook" why someone should watch it based on latest critical reception.
        List 3 highly similar anime that are popular right now.

        Format your response strictly as:
        HOOK: [your hook here]
        SIMILAR: [Anime 1], [Anime 2], [Anime 3]`,config:{tools:[{googleSearch:{}}]}}),a=i.text||"",c=a.match(/HOOK:\s*(.*)/i),e=a.match(/SIMILAR:\s*(.*)/i),m=((t=(r=(n=(o=i.candidates)==null?void 0:o[0])==null?void 0:n.groundingMetadata)==null?void 0:r.groundingChunks)==null?void 0:t.map(s=>s.web).filter(Boolean))||[];return{data:{hook:c?c[1].trim():"Experience a masterclass in storytelling and animation.",similar:e?e[1].split(",").map(s=>s.trim()):[]},sources:m}}catch(i){return console.error("Gemini Insight Error:",i),null}},discoverAnime:async l=>{var h,o,n,r;try{const t=await g.models.generateContent({model:"gemini-3-flash-preview",contents:`The user wants anime recommendations based on this vibe: "${l}".
        Use Google Search to find current, trending, or highly-rated anime that fit this description perfectly.
        Provide 4 recommendations.

        Format each item as:
        TITLE: [Anime Name]
        REASON: [Short compelling reason]`,config:{tools:[{googleSearch:{}}]}}),a=(t.text||"").split(/TITLE:/i).filter(e=>e.trim()).map(e=>{const m=e.split(`
`),s=m[0].trim(),d=m.find(u=>u.toUpperCase().includes("REASON:")),p=d?d.replace(/REASON:/i,"").trim():"Highly recommended for your current mood.";return{title:s,reason:p}}),c=((r=(n=(o=(h=t.candidates)==null?void 0:h[0])==null?void 0:o.groundingMetadata)==null?void 0:n.groundingChunks)==null?void 0:r.map(e=>e.web).filter(Boolean))||[];return{data:a.slice(0,4),sources:c}}catch(t){return console.error("Discovery Error:",t),null}}};export{f as geminiService};
