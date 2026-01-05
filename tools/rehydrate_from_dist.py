import re
import pathlib


def rehydrate_production_orders() -> None:
    src_path = pathlib.Path(
        "backend/dist/backend/src/modules/scm/production-orders/production-orders.service.js"
    )
    out_path = pathlib.Path(
        "backend/src/modules/scm/production-orders/production-orders.service.ts"
    )

    src = src_path.read_text(encoding="utf-8")
    # Drop commonjs export boilerplate but keep __decorate/__metadata for Nest
    src = re.sub(r'^"use strict";\s*', "", src)
    src = re.sub(
        r"Object\.defineProperty\(exports,[\s\S]*?\);\nexports\.ProductionOrdersService = void 0;\n",
        "",
        src,
    )
    src = re.sub(r"exports\.ProductionOrdersService = ProductionOrdersService;\n", "", src)
    src = re.sub(r"//\# sourceMappingURL=.*\n?", "", src)

    if "export { ProductionOrdersService }" not in src:
        src += "\nexport { ProductionOrdersService };\n"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(src, encoding="utf-8")
    print(f"wrote {out_path} ({len(src)} chars)")


def rehydrate_scm_supplies() -> None:
    src_path = pathlib.Path(
        "backend/dist/backend/src/modules/scm/supplies/scm-supplies.service.js"
    )
    out_path = pathlib.Path(
        "backend/src/modules/scm/supplies/scm-supplies.service.ts"
    )

    src = src_path.read_text(encoding="utf-8")
    src = re.sub(r'^"use strict";\s*', "", src)
    src = re.sub(
        r"Object\.defineProperty\(exports,[\s\S]*?\);\nexports\.ScmSuppliesService = void 0;\n",
        "",
        src,
    )
    src = re.sub(r"exports\.ScmSuppliesService = ScmSuppliesService;\n", "", src)
    src = re.sub(r"//\# sourceMappingURL=.*\n?", "", src)

    if "export { ScmSuppliesService }" not in src:
        src += "\nexport { ScmSuppliesService };\n"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(src, encoding="utf-8")
    print(f"wrote {out_path} ({len(src)} chars)")


if __name__ == "__main__":
    rehydrate_production_orders()
    rehydrate_scm_supplies()





def rehydrate_production_orders() -> None:
    src_path = pathlib.Path(
        "backend/dist/backend/src/modules/scm/production-orders/production-orders.service.js"
    )
    out_path = pathlib.Path(
        "backend/src/modules/scm/production-orders/production-orders.service.ts"
    )

    src = src_path.read_text(encoding="utf-8")
    # Drop commonjs export boilerplate but keep __decorate/__metadata for Nest
    src = re.sub(r'^"use strict";\s*', "", src)
    src = re.sub(
        r"Object\.defineProperty\(exports,[\s\S]*?\);\nexports\.ProductionOrdersService = void 0;\n",
        "",
        src,
    )
    src = re.sub(r"exports\.ProductionOrdersService = ProductionOrdersService;\n", "", src)
    src = re.sub(r"//\# sourceMappingURL=.*\n?", "", src)

    if "export { ProductionOrdersService }" not in src:
        src += "\nexport { ProductionOrdersService };\n"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(src, encoding="utf-8")
    print(f"wrote {out_path} ({len(src)} chars)")


def rehydrate_scm_supplies() -> None:
    src_path = pathlib.Path(
        "backend/dist/backend/src/modules/scm/supplies/scm-supplies.service.js"
    )
    out_path = pathlib.Path(
        "backend/src/modules/scm/supplies/scm-supplies.service.ts"
    )

    src = src_path.read_text(encoding="utf-8")
    src = re.sub(r'^"use strict";\s*', "", src)
    src = re.sub(
        r"Object\.defineProperty\(exports,[\s\S]*?\);\nexports\.ScmSuppliesService = void 0;\n",
        "",
        src,
    )
    src = re.sub(r"exports\.ScmSuppliesService = ScmSuppliesService;\n", "", src)
    src = re.sub(r"//\# sourceMappingURL=.*\n?", "", src)

    if "export { ScmSuppliesService }" not in src:
        src += "\nexport { ScmSuppliesService };\n"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(src, encoding="utf-8")
    print(f"wrote {out_path} ({len(src)} chars)")


if __name__ == "__main__":
    rehydrate_production_orders()
    rehydrate_scm_supplies()


