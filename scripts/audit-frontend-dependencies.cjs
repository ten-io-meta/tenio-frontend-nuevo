"use strict";
// Read-only npm lockfile review: no npm audit fix, no package writes or deployments.
const { spawnSync, execFileSync } = require("node:child_process");
const fs = require("node:fs");
function audit(args) {
  const p = spawnSync("npm", ["audit", "--json", "--audit-level=low", ...args], {
    encoding: "utf8", timeout: 120000, maxBuffer: 30 * 1024 * 1024,
    env: { ...process.env, CI: "true" }
  });
  let body;
  try { body = JSON.parse(p.stdout || "{}"); }
  catch {
    throw new Error("npm audit "+args.join(" ")+" returned non-JSON output, status="+p.status+" stderr="+(p.stderr||"").slice(0,200));
  }
  if (p.error || body.error || !body.vulnerabilities || !body.metadata?.vulnerabilities) {
    throw new Error("npm audit "+args.join(" ")+" failed rather than returning a report: "+
      JSON.stringify(body.error||p.error||{status:p.status,stderr:p.stderr}).slice(0,300));
  }
  return body;
}
function summary(report) {
  const c=report.metadata.vulnerabilities || {};
  return {info:c.info||0,low:c.low||0,moderate:c.moderate||0,
    high:c.high||0,critical:c.critical||0,total:c.total||0};
}
function normalize(name,v) {
  const via=Array.isArray(v.via)?v.via.map(x=>typeof x==="string"?
    {dependency:x}:{name:x.name,title:x.title,url:x.url,range:x.range,severity:x.severity}):[];
  return {package:name,severity:v.severity,range:v.range,isDirect:!!v.isDirect,
    affectedNodes:v.nodes||[],via,effects:v.effects||[],
    fixAvailable:v.fixAvailable??false};
}
try {
  const all=audit([]);
  const production=audit(["--omit=dev"]);
  const full=Object.entries(all.vulnerabilities).map(([name,v])=>normalize(name,v));
  const prodNames=new Set(Object.keys(production.vulnerabilities));
  const findings=full.map(x=>({...x,inProductionAudit:prodNames.has(x.package)}));
  const roots=Object.keys(JSON.parse(fs.readFileSync("package.json","utf8")).dependencies||{});
  const report={
    schema:"TENIO_FRONTEND_LOCKFILE_SECURITY_REVIEW",date:new Date().toISOString(),
    npm:execFileSync("npm",["--version"],{encoding:"utf8"}).trim(),
    dependencyLockfile:"package-lock.json",readOnly:true,performedFix:false,
    note:"npm --omit=dev is a graph approximation, not proof of runtime exploitability or browser bundle inclusion.",
    summaryAll:summary(all),summaryProduction:summary(production),
    directProductionDependencies:roots,findings,
    productionFindings:Object.entries(production.vulnerabilities).map(([name,v])=>normalize(name,v))
  };
  fs.mkdirSync("audit-results",{recursive:true});
  fs.writeFileSync("audit-results/frontend-dependency-audit.json",JSON.stringify(report,null,2)+"\n");
  console.log("DEPENDENCY_AUDIT_SUMMARY "+JSON.stringify({
    all:report.summaryAll,omitDev:report.summaryProduction,
    totalAffectedPackages:full.length,productionAffectedPackages:prodNames.size,
    directProd:roots
  }));
  for(const issue of findings.filter(x=>x.isDirect ||
    (x.inProductionAudit && ["critical","high"].includes(x.severity)))) {
    console.log("DEPENDENCY_AUDIT_FINDING "+JSON.stringify({
      name:issue.package,severity:issue.severity,production:issue.inProductionAudit,
      direct:issue.isDirect,via:issue.via.map(x=>x.name||x.dependency).slice(0,8),
      fixAvailable:issue.fixAvailable,range:issue.range
    }));
  }
  console.log("DEPENDENCY_AUDIT_ARTIFACT audit-results/frontend-dependency-audit.json");
} catch(e) {
  console.error("DEPENDENCY_AUDIT_INCONCLUSIVE "+(e.stack||String(e)));
  process.exitCode=2;
}
