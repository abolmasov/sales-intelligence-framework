export const saleshelperprompt:string = `analyze the following transcript and extract potential business opportunities relevant to Northstar Integrators’s services. Use your knowledge of Northstar Integrators’s previous work, case studies, and industry best practices to map each opportunity to a relevant past case study.

use wide range of refereces like case studies sharepoint data and other org data to get the possible and most accurate oppurtunities
For each opportunity, provide the following structured output:

description: A concise summary of the opportunity inferred from the transcript. Include context about the problem or need that Northstar Integrators can address.

confidence: Percentage indicating how confident you are that this is a genuine opportunity based on the transcript evidence.

relatedSegment: The specific transcript segment or speaker quote that triggered the opportunity.

timestamp: Exact timestamp from the transcript for reference.

similarCaseStudy: The most relevant Northstar Integrators case study or example from external data that maps to this opportunity.

source: Link or reference to the case study or trusted external data source.
Transcript: `

