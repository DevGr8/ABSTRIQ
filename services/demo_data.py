"""
services/demo_data.py
Predefined, non-sensitive static demonstration data for ABSTRIQ public visitors.
Used exclusively on the public website for interactive exploration without requiring sign-in.
Never writes to Firestore or private user workspaces.
"""

SAMPLE_DEMO_TITLE = "SparseFlash: Dynamic Block Sparsification for Low-Latency 64k-Context LLM Inference"

SAMPLE_DEMO_ABSTRACT = (
    "Transformer language models suffer from quadratic computational and memory complexity with respect "
    "to sequence length, creating a major performance bottleneck when processing extended documents. "
    "In this paper, we propose SparseFlash, an efficient attention mechanism that leverages dynamic block "
    "sparsification to retain salient key-value states while discarding redundant tokens during autoregressive inference. "
    "We evaluate SparseFlash across 16 tasks in LongBench on sequence lengths up to 64k tokens using Llama-3-8B. "
    "Our experiments demonstrate that SparseFlash achieves a 4.2x speedup in attention throughput and reduces "
    "peak memory consumption by 68% compared to FlashAttention-2, while retaining 98.4% of full-attention task accuracy. "
    "These findings show that dynamic block sparsification provides a scalable and practical solution for deploying "
    "64k-context language models on commodity enterprise hardware."
)

SAMPLE_DEMO_RESULT = {
    "is_demo": True,
    "success": True,
    "paper_title": SAMPLE_DEMO_TITLE,
    "word_count": 128,
    "total_score": 18,
    "maximum_score": 20,
    "percentage": 90.0,
    "rating": "Exemplary",
    "scores": {
        "purpose": 4,
        "method": 4,
        "results": 4,
        "conclusion": 3,
        "clarity": 3,
    },
    "explanations": {
        "purpose": "Explicitly frames the quadratic complexity bottleneck of transformers and states the clear objective of dynamic block sparsification.",
        "method": "Provides concrete architectural details (SparseFlash, dynamic block sparsification) and benchmark setup (LongBench 16 tasks, 64k tokens, Llama-3-8B).",
        "results": "Delivers rigorous empirical metrics: 4.2x throughput speedup, 68% memory reduction, and 98.4% full-attention accuracy retention.",
        "conclusion": "Clearly identifies the main contribution and practical deployment impact on commodity hardware, though limitations or future work are implicit.",
        "clarity": "Structured academic progression (Problem -> Approach -> Benchmark -> Impact) within ideal length (128 words).",
    },
    "evidence": {
        "purpose": "Transformer language models suffer from quadratic computational and memory complexity with respect to sequence length, creating a major performance bottleneck when processing extended documents.",
        "method": "We evaluate SparseFlash across 16 tasks in LongBench on sequence lengths up to 64k tokens using Llama-3-8B.",
        "results": "Our experiments demonstrate that SparseFlash achieves a 4.2x speedup in attention throughput and reduces peak memory consumption by 68% compared to FlashAttention-2, while retaining 98.4% of full-attention task accuracy.",
        "conclusion": "These findings show that dynamic block sparsification provides a scalable and practical solution for deploying 64k-context language models on commodity enterprise hardware.",
        "clarity": "In this paper, we propose SparseFlash, an efficient attention mechanism that leverages dynamic block sparsification to retain salient key-value states while discarding redundant tokens during autoregressive inference.",
    },
    "suggestions": [
        "Include an explicit limitation or edge case (e.g. degradation on ultra-rare needle retrieval) to attain full marks (4/4) in Conclusion.",
        "Sharpen the transition between methodology and empirical results for maximum rhetorical clarity."
    ],
    "llm": {
        "provider": "demonstration-engine",
        "model": "academic-rubric-v3-sample",
        "latency_s": 0.08,
    },
    "disclaimer": "This is a static demonstration evaluation. Real evaluations in your private workspace use live LLM inference with verbatim quote validation and encrypted storage."
}
