// Certification Report Generator - L4 certification evidence
// Normative: OSA-Conformance-Specification-v1.0.md §8

import { EvidenceId, createEvidenceId, now, randomUUID } from '@osa/constitutional-types';

export class CertificationReportGenerator {
  generate(report: any): string {
    const { suite, level, timestamp, duration_ms, summary, results, evidence_summary, certification } = report;

    let md = `# Conformance Certification Report\n\n`;
    md += `**Suite:** ${suite}\n`;
    md += `**Level:** ${level}\n`;
    md += `**Timestamp:** ${timestamp}\n`;
    md += `**Duration:** ${duration_ms}ms\n\n`;

    md += `## Summary\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Total Tests | ${summary.total} |\n`;
    md += `| Passed | ${summary.passed} |\n`;
    md += `| Failed | ${summary.failed} |\n`;
    md += `| Errors | ${summary.errors} |\n`;
    md += `| Skipped | ${summary.skipped} |\n\n`;

    md += `## Evidence Summary\n\n`;
    md += `| Level | Count |\n|-------|-------|\n`;
    for (const [level, count] of Object.entries(evidence_summary.by_level)) {
      md += `| ${level} | ${count} |\n`;
    }
    md += `\n`;
    md += `- Chain Verification Passed: ${evidence_summary.chain_verification_passed}\n`;
    md += `- Chain Verification Failed: ${evidence_summary.chain_verification_failed}\n`;
    md += `- Causality Complete: ${evidence_summary.causality_complete}\n`;
    md += `- Causality Incomplete: ${evidence_summary.causality_incomplete}\n`;
    md += `- Replay Matches: ${evidence_summary.replay_matches}\n`;
    md += `- Replay Divergences: ${evidence_summary.replay_divergences}\n\n`;

    md += `## Certification\n\n`;
    md += `- **Level:** ${certification.level}\n`;
    md += `- **Granted:** ${certification.granted ? 'YES' : 'NO'}\n`;
    if (certification.conditions && certification.conditions.length > 0) {
      md += `- **Conditions:**\n`;
      for (const c of certification.conditions) {
        md += `  - ${c}\n`;
      }
    }
    md += `- **Evidence Ref:** ${certification.evidence_ref}\n\n`;

    md += `## Failed Tests\n\n`;
    const failed = results.filter((r: any) => r.status === 'FAIL' || r.status === 'ERROR');
    if (failed.length === 0) {
      md += `None\n`;
    } else {
      md += `| Test ID | Vector ID | Status | Error |\n|---------|-----------|--------|-------|\n`;
      for (const f of failed) {
        md += `| ${f.testId} | ${f.vectorId} | ${f.status} | ${f.error || f.failureReason || ''} |\n`;
      }
    }

    return md;
  }
}

export class EvidenceSummaryGenerator {
  generate(results: any[]): string {
    const total = results.reduce((sum, r) => sum + (r.evidenceProduced?.length || 0), 0);
    const byLevel: Record<string, number> = { E0: 0, E1: 0, E2: 0, E3: 0, E4: 0 };
    let chainPassed = 0, chainFailed = 0, causalityComplete = 0, causalityIncomplete = 0;
    let replayMatches = 0, replayDivergences = 0;

    for (const r of results) {
      if (r.evidenceProduced) {
        for (const e of r.evidenceProduced) {
          const level = e.charAt(1);
          if (byLevel[`E${level}`] !== undefined) byLevel[`E${level}`]++;
        }
      }
      if (r.chainVerified === true) chainPassed++;
      if (r.chainVerified === false) chainFailed++;
      if (r.causalityComplete === true) causalityComplete++;
      if (r.causalityComplete === false) causalityIncomplete++;
      if (r.replayMatch === true) replayMatches++;
      if (r.replayMatch === false) replayDivergences++;
    }

    let md = `# Evidence Summary Report\n\n`;
    md += `Generated: ${now()}\n\n`;
    md += `## Total Evidence Produced: ${total}\n\n`;
    md += `## By Level\n\n`;
    md += `| Level | Count |\n|-------|-------|\n`;
    for (const [level, count] of Object.entries(byLevel)) {
      md += `| ${level} | ${count} |\n`;
    }
    md += `\n`;
    md += `## Verification\n\n`;
    md += `- Chain Verification Passed: ${chainPassed}\n`;
    md += `- Chain Verification Failed: ${chainFailed}\n`;
    md += `- Causality Complete: ${causalityComplete}\n`;
    md += `- Causality Incomplete: ${causalityIncomplete}\n`;
    md += `- Replay Matches: ${replayMatches}\n`;
    md += `- Replay Divergences: ${replayDivergences}\n`;

    return md;
  }
}