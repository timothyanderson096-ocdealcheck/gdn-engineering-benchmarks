const views = {
  condensed: `
    <div class="mode-summary">
      <span class="status verified">Verified</span>
      <strong>Immutable state update confirmed</strong>
      <p>The original builder implementation mutated its input. Independent review and a failing regression test exposed the defect before acceptance.</p>
      <div class="mode-metrics">
        <div><small>Main defect caught</small><b>Original state was mutated</b></div>
        <div><small>Verification status</small><b>2 of 2 checks pass</b></div>
        <div><small>Next action</small><b>Retain the regression test</b></div>
      </div>
    </div>`,
  balanced: `
    <div class="balanced-view">
      <div><small>Final result</small><b><span class="status verified">Verified</span> Immutable update</b></div>
      <div><small>Strongest evidence</small><b>Identity and value regression checks pass</b></div>
      <div><small>Reviewer disagreement</small><b>Builder returned the same object reference</b></div>
      <div><small>Machine verification</small><b>Initial test failed: expected references to differ</b></div>
      <div><small>Repair</small><b>Return a new object with the revised value</b></div>
      <div><small>Final judgement</small><b>Claim supported after re-verification</b></div>
    </div>`,
  audit: `
    <div class="audit-view">
      <div class="audit-head"><span>Step</span><span>Chronology</span><span>Evidence state</span></div>
      <ol>
        <li><time>01 · BUILD</time><span>Builder implements an in-place assignment and claims completion.</span><em class="warn">CLAIMED</em></li>
        <li><time>02 · REVIEW</time><span>Adversarial Reviewer challenges reference identity and input mutation.</span><em class="warn">DISPUTED</em></li>
        <li><time>03 · VERIFY</time><span>Regression test observes <code>result === original</code>.</span><em class="bad">FAILED</em></li>
        <li><time>04 · JUDGE</time><span>Evidence Judge rejects the completion claim.</span><em class="bad">CONTRADICTED</em></li>
        <li><time>05 · REPAIR</time><span>Implementation changes to <code>{ ...state, value }</code>.</span><em class="warn">REPAIRED</em></li>
        <li><time>06 · RE-VERIFY</time><span>Identity and value regression checks both pass.</span><em class="good">PASSED</em></li>
        <li><time>07 · JUDGE</time><span>Evidence Judge accepts the repaired result.</span><em class="good">VERIFIED</em></li>
      </ol>
      <p>All underlying claims, disagreements, evidence, repair details, and verification history remain available in this view.</p>
    </div>`
};

const panel = document.querySelector('#mode-panel');
const tabs = [...document.querySelectorAll('[data-mode]')];

function selectMode(mode) {
  panel.innerHTML = views[mode];
  tabs.forEach((tab) => {
    const selected = tab.dataset.mode === mode;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectMode(tab.dataset.mode));
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    next.focus();
    selectMode(next.dataset.mode);
  });
});

selectMode('condensed');
