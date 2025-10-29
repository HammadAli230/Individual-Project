import pandas as pd
from .data import features_df

def get_demand_index() -> pd.DataFrame:
    df = features_df().copy()
    for nation in df['nation'].unique():
        mask = df['nation'] == nation
        for col in ['pop_density', 'retail_density', 'broadband_pct', 'student_pct']:
            mu = df.loc[mask, col].mean()
            sd = df.loc[mask, col].std() or 1.0
            df.loc[mask, f"z_{col}"] = (df.loc[mask, col] - mu) / sd
    df['demand_idx'] = (
        0.40*df['z_pop_density'] +
        0.30*df['z_retail_density'] +
        0.20*df['z_broadband_pct'] +
        0.10*df['z_student_pct']
    )
    mn, mx = df['demand_idx'].min(), df['demand_idx'].max()
    df['demand_idx'] = (df['demand_idx'] - mn) / (mx - mn + 1e-9)
    return df[['zone_id','nation','name','lad_code','lad_name','demand_idx']]
